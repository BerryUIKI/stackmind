use notify_debouncer_mini::{Debouncer, new_debouncer, notify::RecursiveMode};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// Self-write suppression registry to prevent infinite watcher loops from internal saves.
#[derive(Clone, Default)]
pub struct SelfWriteRegistry {
    entries: Arc<Mutex<HashMap<PathBuf, (String, Instant)>>>,
}

impl SelfWriteRegistry {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register(&self, path: &Path, content_hash: &str) {
        if let Ok(mut map) = self.entries.lock() {
            // Clean up old entries older than 2000ms
            let now = Instant::now();
            map.retain(|_, (_, time)| now.duration_since(*time) < Duration::from_millis(2000));
            map.insert(path.to_path_buf(), (content_hash.to_string(), now));
        }
    }

    pub fn is_self_write(&self, path: &Path) -> bool {
        if let Ok(mut map) = self.entries.lock() {
            let now = Instant::now();
            if let Some((_, time)) = map.get(path) {
                if now.duration_since(*time) < Duration::from_millis(1500) {
                    map.remove(path);
                    return true;
                }
            }
        }
        false
    }
}

pub struct WorkspaceWatcher {
    _debouncer: Debouncer<notify::RecommendedWatcher>,
}

impl WorkspaceWatcher {
    pub fn start(
        workspace_root: PathBuf,
        registry: SelfWriteRegistry,
        app_handle: AppHandle,
    ) -> Result<Self, String> {
        let root_clone = workspace_root.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(300),
            move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, _>| {
                if let Ok(events) = res {
                    for event in events {
                        let path = event.path;
                        let path_str = path.to_string_lossy();

                        // Ignore internal cache and version control directories
                        if path_str.contains(".stackmynd")
                            || path_str.contains(".git")
                            || path_str.ends_with('~')
                            || path_str.contains(".tmp.")
                        {
                            continue;
                        }

                        // Check self-write suppression
                        if registry.is_self_write(&path) {
                            continue;
                        }

                        if let Ok(rel) = path.strip_prefix(&root_clone) {
                            let rel_str = rel.to_string_lossy().replace('\\', "/");
                            let payload = serde_json::json!({
                                "relative_path": rel_str,
                                "is_file": path.is_file(),
                            });
                            let _ = app_handle.emit("external_file_changed", payload);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create file watcher: {e}"))?;

        debouncer
            .watcher()
            .watch(&workspace_root, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watching directory: {e}"))?;

        Ok(Self {
            _debouncer: debouncer,
        })
    }
}
