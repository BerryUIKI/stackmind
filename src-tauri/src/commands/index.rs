use crate::models::db::{BacklinkItem, DbLinkRecord, TagCount};
use crate::services::db::{connection, indexer, rebuild};
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

fn get_workspace_root_and_meta(
    state: &State<'_, AppState>,
) -> Result<(PathBuf, crate::models::workspace::WorkspaceMetadata), String> {
    let active = state.active_workspace.lock().map_err(|e| e.to_string())?;
    active
        .as_ref()
        .map(|w| (PathBuf::from(&w.path), w.clone()))
        .ok_or_else(|| "No active workspace opened".to_string())
}

#[tauri::command]
pub fn get_file_backlinks(
    relative_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<BacklinkItem>, String> {
    let (root, _) = get_workspace_root_and_meta(&state)?;
    let conn = connection::open_db(&root)?;
    indexer::get_file_backlinks(&conn, &relative_path)
}

#[tauri::command]
pub fn get_file_outlinks(
    relative_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<DbLinkRecord>, String> {
    let (root, _) = get_workspace_root_and_meta(&state)?;
    let conn = connection::open_db(&root)?;
    indexer::get_file_outlinks(&conn, &relative_path)
}

#[tauri::command]
pub fn list_workspace_tags(state: State<'_, AppState>) -> Result<Vec<TagCount>, String> {
    let (root, _) = get_workspace_root_and_meta(&state)?;
    let conn = connection::open_db(&root)?;
    indexer::list_tags(&conn)
}

#[tauri::command]
pub fn rebuild_workspace_index(state: State<'_, AppState>) -> Result<(), String> {
    let (root, meta) = get_workspace_root_and_meta(&state)?;
    rebuild::rebuild_workspace_index(&root, &meta)
}
