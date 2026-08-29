use crate::models::transclusion::TransclusionPayload;
use crate::services::transclusion::TransclusionService;
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
pub fn resolve_transclusion(
    target_path: String,
    block_id: Option<String>,
    heading: Option<String>,
    state: State<'_, AppState>,
) -> Result<TransclusionPayload, String> {
    let root = get_workspace_root(&state)?;
    TransclusionService::resolve_transclusion(
        &root,
        &target_path,
        block_id.as_deref(),
        heading.as_deref(),
    )
}
