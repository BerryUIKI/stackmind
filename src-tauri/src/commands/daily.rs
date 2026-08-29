use crate::models::daily::{DailyNoteEntry, DailyNoteResult};
use crate::services::daily::DailyService;
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
pub fn get_or_create_daily_note(
    date: Option<String>,
    state: State<'_, AppState>,
) -> Result<DailyNoteResult, String> {
    let root = get_workspace_root(&state)?;
    DailyService::get_or_create_daily_note(&root, date)
}

#[tauri::command]
pub fn list_daily_notes(state: State<'_, AppState>) -> Result<Vec<DailyNoteEntry>, String> {
    let root = get_workspace_root(&state)?;
    DailyService::list_daily_notes(&root)
}
