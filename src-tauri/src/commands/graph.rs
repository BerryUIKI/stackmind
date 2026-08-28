use crate::models::graph::{GraphFilter, WorkspaceGraphData};
use crate::services::db::connection;
use crate::services::graph::service;
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
pub fn get_workspace_graph_data(
    filter: Option<GraphFilter>,
    state: State<'_, AppState>,
) -> Result<WorkspaceGraphData, String> {
    let root = get_workspace_root(&state)?;
    let conn = connection::open_db(&root)?;
    service::get_workspace_graph(&conn, filter)
}

#[tauri::command]
pub fn get_local_graph_data(
    relative_path: String,
    depth: Option<u32>,
    state: State<'_, AppState>,
) -> Result<WorkspaceGraphData, String> {
    let root = get_workspace_root(&state)?;
    let conn = connection::open_db(&root)?;
    service::get_local_graph(&conn, &relative_path, depth.unwrap_or(1))
}
