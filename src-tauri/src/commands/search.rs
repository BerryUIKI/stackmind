use crate::models::search::SearchResult;
use crate::services::search::engine;
use crate::services::search::schema::SearchSchema;
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
pub fn search_workspace(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let root = get_workspace_root(&state)?;
    let search_dir = root.join(".stackmynd").join("search_index");

    let index = engine::open_or_create_index(&search_dir)?;
    let schema_def = SearchSchema::new();

    engine::search(&index, &schema_def, &query, limit.unwrap_or(30))
}

#[tauri::command]
pub fn rebuild_search_index(state: State<'_, AppState>) -> Result<(), String> {
    let root = get_workspace_root(&state)?;
    engine::rebuild_search_index(&root)
}
