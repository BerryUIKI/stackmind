use crate::models::workspace::WorkspaceMetadata;
use crate::services::watcher_service::{SelfWriteRegistry, WorkspaceWatcher};
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub active_workspace: Arc<Mutex<Option<WorkspaceMetadata>>>,
    pub self_write_registry: SelfWriteRegistry,
    pub watcher: Arc<Mutex<Option<WorkspaceWatcher>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            active_workspace: Arc::new(Mutex::new(None)),
            self_write_registry: SelfWriteRegistry::new(),
            watcher: Arc::new(Mutex::new(None)),
        }
    }
}
