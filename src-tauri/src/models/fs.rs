use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilePayload {
    pub relative_path: String,
    pub content: String,
    pub size_bytes: u64,
    pub mtime_ms: u64,
    pub hash_blake3: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrashRecord {
    pub id: String,
    pub original_relative_path: String,
    pub trash_filename: String,
    pub file_size_bytes: u64,
    pub deleted_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalChangeEvent {
    pub workspace_id: String,
    pub relative_path: String,
    pub change_type: String, // "modify" | "create" | "remove"
}
