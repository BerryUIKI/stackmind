use crate::models::canvas::CanvasData;
use crate::services::canvas::CanvasService;
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
pub fn read_canvas(path: String, state: State<'_, AppState>) -> Result<CanvasData, String> {
    let root = get_workspace_root(&state)?;
    CanvasService::read_canvas(&root, &path)
}

#[tauri::command]
pub fn save_canvas(
    path: String,
    data: CanvasData,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    CanvasService::save_canvas(&root, &path, &data, &state.self_write_registry)
}
