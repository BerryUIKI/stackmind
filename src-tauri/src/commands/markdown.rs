use crate::models::db::{DbBlockRecord, DbLinkRecord};
use crate::models::markdown::{ParsedDocument, RepairedFileResult};
use crate::services::db::{connection, indexer};
use crate::services::fs_service;
use crate::services::markdown::block_anchor;
use crate::services::markdown::block_parser;
use crate::services::markdown::link_repair;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::State;

fn get_workspace_root_and_id(state: &State<'_, AppState>) -> Result<(PathBuf, String), String> {
    let active = state.active_workspace.lock().map_err(|e| e.to_string())?;
    active
        .as_ref()
        .map(|w| (PathBuf::from(&w.path), w.id.clone()))
        .ok_or_else(|| "No active workspace opened".to_string())
}

#[tauri::command]
pub fn parse_document(
    relative_path: String,
    state: State<'_, AppState>,
) -> Result<ParsedDocument, String> {
    let (root, ws_id) = get_workspace_root_and_id(&state)?;
    let payload = fs_service::read_file(&root, &relative_path)?;
    let parsed = block_parser::parse_markdown_document(&payload.content);

    // Synchronize SQLite index with newly parsed blocks and links
    if let Ok(mut conn) = connection::open_db(&root) {
        if let Ok(file_id) =
            indexer::upsert_file_record(&conn, &ws_id, &payload, parsed.frontmatter_raw.as_deref())
        {
            // Map parsed blocks to DB records
            let db_blocks: Vec<DbBlockRecord> = parsed
                .blocks
                .iter()
                .map(|b| DbBlockRecord {
                    id: 0,
                    file_id,
                    block_id: b.block_id.clone(),
                    block_type: b.block_type.clone(),
                    heading_level: b.heading_level,
                    start_line: b.start_line,
                    end_line: b.end_line,
                    start_char: b.start_char,
                    end_char: b.end_char,
                    content_hash: b.content_hash.clone(),
                    text_preview: b.text_preview.clone(),
                    created_at: 0,
                    updated_at: 0,
                })
                .collect();
            let _ = indexer::replace_file_blocks(&mut conn, file_id, &db_blocks);

            // Map parsed links to DB records
            let db_links: Vec<DbLinkRecord> = parsed
                .links
                .iter()
                .map(|l| DbLinkRecord {
                    id: 0,
                    source_file_id: file_id,
                    source_relative_path: relative_path.clone(),
                    source_block_id: None,
                    target_relative_path: l.target_path.clone(),
                    target_file_id: None,
                    target_block_id: l.target_block_id.clone(),
                    link_type: if l.is_wikilink {
                        "wikilink".to_string()
                    } else {
                        "markdown".to_string()
                    },
                    link_text: l.link_text.clone(),
                    line_number: l.line_number,
                    is_broken: false,
                    created_at: 0,
                })
                .collect();
            let _ = indexer::replace_file_links(&mut conn, file_id, &db_links);

            // Sync tags
            let _ = indexer::sync_file_tags(&mut conn, file_id, &parsed.tags);
        }
    }

    Ok(parsed)
}

#[tauri::command]
pub fn insert_block_anchor(
    relative_path: String,
    target_line: u32,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (root, _) = get_workspace_root_and_id(&state)?;
    let payload = fs_service::read_file(&root, &relative_path)?;

    let (updated_content, block_id) =
        block_anchor::insert_anchor_at_line(&payload.content, target_line as usize);

    let target_path = fs_service::sanitize_path(&root, &relative_path)?;
    let blake3_hash = fs_service::calculate_blake3(updated_content.as_bytes());
    state
        .self_write_registry
        .register(&target_path, &blake3_hash);

    let _ = fs_service::atomic_write_file(&root, &relative_path, &updated_content)?;

    Ok(block_id)
}

#[tauri::command]
pub fn repair_links_on_rename(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<RepairedFileResult>, String> {
    let (root, _) = get_workspace_root_and_id(&state)?;
    link_repair::repair_workspace_links(&root, &old_path, &new_path)
}
