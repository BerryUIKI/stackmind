use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbFileRecord {
    pub id: i64,
    pub workspace_id: String,
    pub relative_path: String,
    pub file_name: String,
    pub size_bytes: i64,
    pub mtime_ms: i64,
    pub hash_blake3: String,
    pub frontmatter_raw: Option<String>,
    pub has_frontmatter: bool,
    pub is_deleted: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbBlockRecord {
    pub id: i64,
    pub file_id: i64,
    pub block_id: String,
    pub block_type: String,
    pub heading_level: Option<i32>,
    pub start_line: i32,
    pub end_line: i32,
    pub start_char: i32,
    pub end_char: i32,
    pub content_hash: String,
    pub text_preview: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbLinkRecord {
    pub id: i64,
    pub source_file_id: i64,
    pub source_relative_path: String,
    pub source_block_id: Option<i64>,
    pub target_relative_path: String,
    pub target_file_id: Option<i64>,
    pub target_block_id: Option<String>,
    pub link_type: String,
    pub link_text: String,
    pub line_number: i32,
    pub is_broken: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub name: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BacklinkItem {
    pub source_file_path: String,
    pub source_file_name: String,
    pub line_number: i32,
    pub link_text: String,
    pub target_block_id: Option<String>,
    pub context_snippet: String,
}
