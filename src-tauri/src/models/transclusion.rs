use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransclusionPayload {
    pub resolved_path: String,
    pub title: String,
    pub block_id: Option<String>,
    pub heading: Option<String>,
    pub content: String,
    pub exists: bool,
    pub is_circular: bool,
}
