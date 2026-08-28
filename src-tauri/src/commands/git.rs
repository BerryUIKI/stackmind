use crate::models::git::{GitBranchesResult, GitCommit, GitCommitResult, GitStatusResult};
use crate::services::git::service;
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
pub fn git_status(state: State<'_, AppState>) -> Result<GitStatusResult, String> {
    let root = get_workspace_root(&state)?;
    service::get_status(&root)
}

#[tauri::command]
pub fn git_diff(file_path: Option<String>, state: State<'_, AppState>) -> Result<String, String> {
    let root = get_workspace_root(&state)?;
    service::get_diff(&root, file_path.as_deref())
}

#[tauri::command]
pub fn git_commit(
    message: String,
    stage_all: Option<bool>,
    state: State<'_, AppState>,
) -> Result<GitCommitResult, String> {
    let root = get_workspace_root(&state)?;
    service::commit(&root, &message, stage_all.unwrap_or(true))
}

#[tauri::command]
pub fn git_log(limit: Option<usize>, state: State<'_, AppState>) -> Result<Vec<GitCommit>, String> {
    let root = get_workspace_root(&state)?;
    service::get_log(&root, limit)
}

#[tauri::command]
pub fn git_list_branches(state: State<'_, AppState>) -> Result<GitBranchesResult, String> {
    let root = get_workspace_root(&state)?;
    service::list_branches(&root)
}

#[tauri::command]
pub fn git_checkout_branch(branch_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    service::checkout_branch(&root, &branch_name)
}

#[tauri::command]
pub fn git_create_branch(branch_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    service::create_branch(&root, &branch_name)
}
