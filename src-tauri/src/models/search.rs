use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub file_name: String,
    pub title: String,
    pub block_id: Option<String>,
    pub block_type: Option<String>,
    pub snippet: String,
    pub score: f32,
    pub tags: Vec<String>,
    pub is_block: bool,
}
