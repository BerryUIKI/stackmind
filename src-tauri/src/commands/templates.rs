use crate::models::template::TemplateMetadata;
use crate::services::templates::TemplateService;
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
pub fn list_templates(state: State<'_, AppState>) -> Result<Vec<TemplateMetadata>, String> {
    let root = get_workspace_root(&state)?;
    TemplateService::list_templates(&root)
}

#[tauri::command]
pub fn apply_template(
    template_path: String,
    note_title: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let root = get_workspace_root(&state)?;
    TemplateService::apply_template(&root, &template_path, &note_title)
}
