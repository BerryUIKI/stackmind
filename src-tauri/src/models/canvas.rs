use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String, // "file", "block", "text"
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    #[serde(default, rename = "blockId", skip_serializing_if = "Option::is_none")]
    pub block_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasEdge {
    pub id: String,
    #[serde(rename = "fromNode")]
    pub from_node: String,
    #[serde(default, rename = "fromSide", skip_serializing_if = "Option::is_none")]
    pub from_side: Option<String>, // "top", "right", "bottom", "left"
    #[serde(rename = "toNode")]
    pub to_node: String,
    #[serde(default, rename = "toSide", skip_serializing_if = "Option::is_none")]
    pub to_side: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasData {
    pub version: u32,
    pub nodes: Vec<CanvasNode>,
    pub edges: Vec<CanvasEdge>,
}

impl Default for CanvasData {
    fn default() -> Self {
        Self {
            version: 1,
            nodes: Vec::new(),
            edges: Vec::new(),
        }
    }
}
