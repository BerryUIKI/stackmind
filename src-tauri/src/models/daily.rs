use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNoteEntry {
    pub date: String,          // "YYYY-MM-DD"
    pub relative_path: String, // "daily/YYYY-MM-DD.md"
    pub word_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyNoteResult {
    pub relative_path: String,
    pub date: String,
    pub is_new: bool,
    pub content: String,
}
