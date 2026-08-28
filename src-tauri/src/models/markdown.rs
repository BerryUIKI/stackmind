use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedBlock {
    pub block_id: String,
    pub block_type: String, // "heading", "paragraph", "code", "list", "blockquote", "table", "math", "thematic_break"
    pub heading_level: Option<i32>,
    pub start_line: i32,
    pub end_line: i32,
    pub start_char: i32,
    pub end_char: i32,
    pub content: String,
    pub content_hash: String,
    pub text_preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedLink {
    pub target_path: String,
    pub target_block_id: Option<String>,
    pub target_heading: Option<String>,
    pub alias: Option<String>,
    pub link_text: String,
    pub line_number: i32,
    pub is_wikilink: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    pub frontmatter_raw: Option<String>,
    pub frontmatter_fields: HashMap<String, serde_json::Value>,
    pub tags: Vec<String>,
    pub blocks: Vec<ParsedBlock>,
    pub links: Vec<ParsedLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairedFileResult {
    pub file_path: String,
    pub rewrites_count: usize,
}
