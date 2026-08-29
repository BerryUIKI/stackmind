use crate::models::canvas::CanvasData;
use crate::services::fs_service::{atomic_write_file, calculate_blake3, read_file, sanitize_path};
use crate::services::watcher_service::SelfWriteRegistry;
use std::fs;
use std::path::Path;

pub struct CanvasService;

impl CanvasService {
    pub fn read_canvas(root: &Path, rel_path: &str) -> Result<CanvasData, String> {
        let payload = read_file(root, rel_path)?;
        if payload.content.trim().is_empty() {
            return Ok(CanvasData::default());
        }

        serde_json::from_str::<CanvasData>(&payload.content)
            .map_err(|e| format!("Failed to parse canvas file '{}': {e}", rel_path))
    }

    pub fn save_canvas(
        root: &Path,
        rel_path: &str,
        data: &CanvasData,
        registry: &SelfWriteRegistry,
    ) -> Result<(), String> {
        let serialized = serde_json::to_string_pretty(data)
            .map_err(|e| format!("Failed to serialize canvas data: {e}"))?;

        let target = sanitize_path(root, rel_path)?;
        let blake3_hash = calculate_blake3(serialized.as_bytes());
        registry.register(&target, &blake3_hash);

        atomic_write_file(root, rel_path, &serialized).map(|_| ())
    }

    pub fn repair_canvas_links(
        root: &Path,
        old_path: &str,
        new_path: &str,
        registry: &SelfWriteRegistry,
    ) -> Result<usize, String> {
        let mut repaired_count = 0;
        let mut stack = vec![root.to_path_buf()];

        while let Some(current_dir) = stack.pop() {
            let entries = match fs::read_dir(&current_dir) {
                Ok(e) => e,
                Err(_) => continue,
            };

            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();

                if file_name.starts_with('.') {
                    continue;
                }

                if path.is_dir() {
                    stack.push(path);
                } else if file_name.ends_with(".canvas.json") {
                    if let Ok(rel) = path.strip_prefix(root) {
                        let rel_str = rel.to_string_lossy().to_string();
                        if let Ok(mut canvas) = Self::read_canvas(root, &rel_str) {
                            let mut modified = false;
                            for node in &mut canvas.nodes {
                                if let Some(ref f) = node.file {
                                    if f == old_path {
                                        node.file = Some(new_path.to_string());
                                        modified = true;
                                    }
                                }
                            }

                            if modified
                                && Self::save_canvas(root, &rel_str, &canvas, registry).is_ok()
                            {
                                repaired_count += 1;
                            }
                        }
                    }
                }
            }
        }

        Ok(repaired_count)
    }
}
