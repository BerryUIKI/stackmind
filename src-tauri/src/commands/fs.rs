use crate::models::fs::{FileNode, FilePayload, TrashRecord};
use crate::services::fs_service;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

fn get_workspace_root(state: &State<'_, AppState>) -> Result<PathBuf, String> {
    let active = state.active_workspace.lock().map_err(|e| e.to_string())?;
    active
        .as_ref()
        .map(|w| PathBuf::from(&w.path))
        .ok_or_else(|| "No active workspace opened".to_string())
}

#[tauri::command]
pub fn read_directory(
    relative_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<FileNode>, String> {
    let root = get_workspace_root(&state)?;
    let sub = relative_path.unwrap_or_default();
    fs_service::read_directory_tree(&root, &sub)
}

#[tauri::command]
pub fn read_file(relative_path: String, state: State<'_, AppState>) -> Result<FilePayload, String> {
    let root = get_workspace_root(&state)?;
    fs_service::read_file(&root, &relative_path)
}

#[tauri::command]
pub fn write_file_atomic(
    relative_path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<FilePayload, String> {
    let root = get_workspace_root(&state)?;
    let target = fs_service::sanitize_path(&root, &relative_path)?;

    // Register self-write to suppress watcher feedback loop
    let blake3_hash = fs_service::calculate_blake3(content.as_bytes());
    state.self_write_registry.register(&target, &blake3_hash);

    fs_service::atomic_write_file(&root, &relative_path, &content)
}

#[tauri::command]
pub fn create_file(
    relative_path: String,
    initial_content: Option<String>,
    state: State<'_, AppState>,
) -> Result<FilePayload, String> {
    let root = get_workspace_root(&state)?;
    let content = initial_content.unwrap_or_default();
    let target = fs_service::sanitize_path(&root, &relative_path)?;

    let blake3_hash = fs_service::calculate_blake3(content.as_bytes());
    state.self_write_registry.register(&target, &blake3_hash);

    fs_service::create_file(&root, &relative_path, &content)
}

#[tauri::command]
pub fn create_directory(relative_path: String, state: State<'_, AppState>) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    fs_service::create_directory(&root, &relative_path)
}

#[tauri::command]
pub fn rename_path(
    old_relative_path: String,
    new_relative_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    fs_service::rename_path(&root, &old_relative_path, &new_relative_path)?;
    let _ = crate::services::canvas::CanvasService::repair_canvas_links(
        &root,
        &old_relative_path,
        &new_relative_path,
        &state.self_write_registry,
    );
    Ok(())
}

#[tauri::command]
pub fn delete_to_trash(
    relative_path: String,
    state: State<'_, AppState>,
) -> Result<TrashRecord, String> {
    let root = get_workspace_root(&state)?;
    fs_service::delete_to_trash(&root, &relative_path)
}

#[tauri::command]
pub fn restore_from_trash(
    trash_filename: String,
    original_relative_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    fs_service::restore_from_trash(&root, &trash_filename, &original_relative_path)
}

#[tauri::command]
pub fn list_trash(state: State<'_, AppState>) -> Result<Vec<TrashRecord>, String> {
    let root = get_workspace_root(&state)?;
    fs_service::list_trash(&root)
}

#[tauri::command]
pub fn empty_trash(state: State<'_, AppState>) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    fs_service::empty_trash(&root)
}
