use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: u64,
    pub last_opened_at: u64,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TabState {
    pub relative_path: String,
    pub mode: String, // "source" | "preview" | "split"
    pub scroll_ratio: f64,
    pub cursor_line: u32,
    pub cursor_col: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub open_tabs: Vec<TabState>,
    pub active_tab_path: Option<String>,
    pub sidebar_width: u32,
    pub sidebar_collapsed: bool,
    pub inspector_width: u32,
    pub inspector_collapsed: bool,
    pub inspector_tab: String, // "metadata" | "outlinks" | "backlinks" | "outline"
    pub expanded_folders: Vec<String>,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            open_tabs: Vec::new(),
            active_tab_path: None,
            sidebar_width: 260,
            sidebar_collapsed: false,
            inspector_width: 300,
            inspector_collapsed: false,
            inspector_tab: "metadata".to_string(),
            expanded_folders: Vec::new(),
        }
    }
}
