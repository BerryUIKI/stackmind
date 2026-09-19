use crate::services::export_service;
use std::path::PathBuf;

#[tauri::command]
pub fn export_file(destination_path: String, content: String) -> Result<(), String> {
    let dest = PathBuf::from(destination_path);
    export_service::export_file_to_disk(&dest, &content)
}
