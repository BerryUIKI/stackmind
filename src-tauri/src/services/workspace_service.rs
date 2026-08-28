use crate::models::workspace::{SessionState, WorkspaceMetadata};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub fn get_global_config_dir() -> PathBuf {
    dirs::config_dir()
        .map(|p| p.join("stackmynd"))
        .unwrap_or_else(|| PathBuf::from(".stackmynd_global"))
}

pub fn init_workspace(
    root: &Path,
    name_override: Option<&str>,
) -> Result<WorkspaceMetadata, String> {
    if !root.exists() {
        fs::create_dir_all(root).map_err(|e| format!("Failed to create workspace root: {e}"))?;
    }
    if !root.is_dir() {
        return Err(format!("Workspace root is not a directory: {:?}", root));
    }

    let dot_dir = root.join(".stackmynd");
    fs::create_dir_all(&dot_dir)
        .map_err(|e| format!("Failed to create .stackmynd directory: {e}"))?;
    fs::create_dir_all(dot_dir.join("search_index"))
        .map_err(|e| format!("Failed to create search_index directory: {e}"))?;
    fs::create_dir_all(dot_dir.join("trash"))
        .map_err(|e| format!("Failed to create trash directory: {e}"))?;

    // Create .stackmynd/.gitignore
    let gitignore_path = dot_dir.join(".gitignore");
    if !gitignore_path.exists() {
        let _ = fs::write(
            &gitignore_path,
            "# Transient cache and lock files\nindex.db*\nsearch_index/\n",
        );
    }

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let workspace_json = dot_dir.join("workspace.json");
    let meta = if workspace_json.exists() {
        let content = fs::read_to_string(&workspace_json)
            .map_err(|e| format!("Failed to read workspace.json: {e}"))?;
        let mut loaded: WorkspaceMetadata = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse workspace.json: {e}"))?;
        loaded.last_opened_at = now_ms;
        let _ = fs::write(
            &workspace_json,
            serde_json::to_string_pretty(&loaded).unwrap_or_default(),
        );
        loaded
    } else {
        let name = name_override.map(|s| s.to_string()).unwrap_or_else(|| {
            root.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Workspace")
                .to_string()
        });

        let new_meta = WorkspaceMetadata {
            id: Uuid::new_v4().to_string(),
            name,
            path: root.to_string_lossy().to_string(),
            created_at: now_ms,
            last_opened_at: now_ms,
            version: "1.0.0".to_string(),
        };
        let mut file = File::create(&workspace_json)
            .map_err(|e| format!("Failed to create workspace.json: {e}"))?;
        let serialized = serde_json::to_string_pretty(&new_meta)
            .map_err(|e| format!("Failed to serialize workspace metadata: {e}"))?;
        file.write_all(serialized.as_bytes())
            .map_err(|e| format!("Failed to write workspace.json: {e}"))?;
        new_meta
    };

    // Ensure session.json exists
    let session_json = dot_dir.join("session.json");
    if !session_json.exists() {
        let default_session = SessionState::default();
        let _ = fs::write(
            &session_json,
            serde_json::to_string_pretty(&default_session).unwrap_or_default(),
        );
    }

    // Register in global workspace registry
    let _ = register_workspace(&meta);

    Ok(meta)
}

pub fn save_session(workspace_root: &Path, session: &SessionState) -> Result<(), String> {
    let session_json = workspace_root.join(".stackmynd").join("session.json");
    let serialized = serde_json::to_string_pretty(session)
        .map_err(|e| format!("Failed to serialize session state: {e}"))?;
    fs::write(&session_json, serialized).map_err(|e| format!("Failed to save session.json: {e}"))
}

pub fn load_session(workspace_root: &Path) -> Result<SessionState, String> {
    let session_json = workspace_root.join(".stackmynd").join("session.json");
    if !session_json.exists() {
        return Ok(SessionState::default());
    }
    let content = fs::read_to_string(&session_json)
        .map_err(|e| format!("Failed to read session.json: {e}"))?;
    let session: SessionState =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse session.json: {e}"))?;
    Ok(session)
}

pub fn register_workspace(meta: &WorkspaceMetadata) -> Result<(), String> {
    let config_dir = get_global_config_dir();
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {e}"))?;

    let registry_file = config_dir.join("workspaces.json");
    let mut workspaces: Vec<WorkspaceMetadata> = if registry_file.exists() {
        fs::read_to_string(&registry_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    // Update existing or append
    if let Some(existing) = workspaces
        .iter_mut()
        .find(|w| w.id == meta.id || w.path == meta.path)
    {
        *existing = meta.clone();
    } else {
        workspaces.push(meta.clone());
    }

    let serialized = serde_json::to_string_pretty(&workspaces)
        .map_err(|e| format!("Failed to serialize workspaces: {e}"))?;
    fs::write(&registry_file, serialized)
        .map_err(|e| format!("Failed to save workspaces.json: {e}"))
}

pub fn list_registered_workspaces() -> Result<Vec<WorkspaceMetadata>, String> {
    let registry_file = get_global_config_dir().join("workspaces.json");
    if !registry_file.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&registry_file)
        .map_err(|e| format!("Failed to read workspaces.json: {e}"))?;
    let workspaces: Vec<WorkspaceMetadata> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspaces.json: {e}"))?;
    Ok(workspaces)
}

pub fn remove_workspace_from_registry(id: &str) -> Result<(), String> {
    let registry_file = get_global_config_dir().join("workspaces.json");
    if !registry_file.exists() {
        return Ok(());
    }
    let content = fs::read_to_string(&registry_file)
        .map_err(|e| format!("Failed to read workspaces.json: {e}"))?;
    let mut workspaces: Vec<WorkspaceMetadata> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspaces.json: {e}"))?;

    workspaces.retain(|w| w.id != id);

    let serialized = serde_json::to_string_pretty(&workspaces)
        .map_err(|e| format!("Failed to serialize workspaces: {e}"))?;
    fs::write(&registry_file, serialized)
        .map_err(|e| format!("Failed to save workspaces.json: {e}"))
}
