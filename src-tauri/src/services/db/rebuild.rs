use crate::models::workspace::WorkspaceMetadata;
use crate::services::db::{connection, indexer, schema};
use crate::services::fs_service;
use std::fs;
use std::path::Path;

pub fn rebuild_workspace_index(
    workspace_root: &Path,
    meta: &WorkspaceMetadata,
) -> Result<(), String> {
    let dot_dir = workspace_root.join(".stackmynd");
    fs::create_dir_all(&dot_dir)
        .map_err(|e| format!("Failed to create .stackmynd directory: {e}"))?;

    let rebuild_db_path = dot_dir.join("index.db.rebuild");
    if rebuild_db_path.exists() {
        let _ = fs::remove_file(&rebuild_db_path);
    }

    // Step 1: Open and initialize shadow database
    let conn = connection::open_db_at_path(&rebuild_db_path)?;
    schema::initialize_schema(&conn)?;

    // Step 2: Register workspace
    indexer::upsert_workspace(&conn, meta)?;

    // Step 3: Scan all markdown files recursively
    let nodes = fs_service::read_directory_tree(workspace_root, "")?;
    let mut files_to_index: Vec<String> = Vec::new();
    collect_markdown_paths(&nodes, &mut files_to_index);

    // Step 4: Ingest files into shadow database
    for rel_path in files_to_index {
        if let Ok(payload) = fs_service::read_file(workspace_root, &rel_path) {
            let _ = indexer::upsert_file_record(&conn, &meta.id, &payload, None);
        }
    }

    // Step 5: Close connection safely before atomic swap
    drop(conn);

    // Step 6: Atomic swap over index.db
    let target_db_path = dot_dir.join("index.db");
    fs::rename(&rebuild_db_path, &target_db_path)
        .map_err(|e| format!("Failed to atomic swap rebuild database: {e}"))?;

    Ok(())
}

fn collect_markdown_paths(nodes: &[crate::models::fs::FileNode], output: &mut Vec<String>) {
    for n in nodes {
        if n.is_dir {
            if let Some(children) = &n.children {
                collect_markdown_paths(children, output);
            }
        } else if n.name.ends_with(".md") || n.name.ends_with(".markdown") {
            output.push(n.relative_path.clone());
        }
    }
}
