use crate::models::workspace::{SessionState, WorkspaceMetadata};
use crate::services::watcher_service::WorkspaceWatcher;
use crate::services::workspace_service;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn init_or_open_workspace(
    path: String,
    name: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<WorkspaceMetadata, String> {
    let root = PathBuf::from(&path);
    let meta = workspace_service::init_workspace(&root, name.as_deref())?;

    // Update active workspace in managed state
    if let Ok(mut active) = state.active_workspace.lock() {
        *active = Some(meta.clone());
    }

    // Start or restart watcher
    if let Ok(mut watcher_lock) = state.watcher.lock() {
        let registry = state.self_write_registry.clone();
        if let Ok(watcher) = WorkspaceWatcher::start(root, registry, app_handle) {
            *watcher_lock = Some(watcher);
        }
    }

    Ok(meta)
}

#[tauri::command]
pub fn get_active_workspace(
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceMetadata>, String> {
    if let Ok(active) = state.active_workspace.lock() {
        Ok(active.clone())
    } else {
        Err("Failed to acquire active workspace lock".to_string())
    }
}

#[tauri::command]
pub fn list_workspaces() -> Result<Vec<WorkspaceMetadata>, String> {
    workspace_service::list_registered_workspaces()
}

#[tauri::command]
pub fn remove_workspace(id: String) -> Result<(), String> {
    workspace_service::remove_workspace_from_registry(&id)
}

#[tauri::command]
pub fn save_workspace_session(
    session: SessionState,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let root_path = {
        let active = state.active_workspace.lock().map_err(|e| e.to_string())?;
        active
            .as_ref()
            .map(|w| PathBuf::from(&w.path))
            .ok_or_else(|| "No active workspace".to_string())?
    };
    workspace_service::save_session(&root_path, &session)
}

#[tauri::command]
pub fn load_workspace_session(state: State<'_, AppState>) -> Result<SessionState, String> {
    let root_path = {
        let active = state.active_workspace.lock().map_err(|e| e.to_string())?;
        active
            .as_ref()
            .map(|w| PathBuf::from(&w.path))
            .ok_or_else(|| "No active workspace".to_string())?
    };
    workspace_service::load_session(&root_path)
}
