use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMetadata {
    pub name: String,
    pub relative_path: String,
    pub description: Option<String>,
    pub content: String,
}
