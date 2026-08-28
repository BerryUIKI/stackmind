use crate::models::db::{BacklinkItem, DbBlockRecord, DbLinkRecord, TagCount};
use crate::models::fs::FilePayload;
use crate::models::workspace::WorkspaceMetadata;
use rusqlite::{Connection, params};
use std::time::{SystemTime, UNIX_EPOCH};

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub fn upsert_workspace(conn: &Connection, meta: &WorkspaceMetadata) -> Result<(), String> {
    conn.execute(
        "INSERT INTO workspaces (id, path, name, schema_version, created_at, last_opened_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            path = excluded.path,
            name = excluded.name,
            last_opened_at = excluded.last_opened_at;",
        params![
            meta.id,
            meta.path,
            meta.name,
            meta.created_at as i64,
            meta.last_opened_at as i64
        ],
    )
    .map_err(|e| format!("Failed to upsert workspace in db: {e}"))?;
    Ok(())
}

pub fn upsert_file_record(
    conn: &Connection,
    workspace_id: &str,
    payload: &FilePayload,
    frontmatter_raw: Option<&str>,
) -> Result<i64, String> {
    let now = now_ms();
    let file_name = std::path::Path::new(&payload.relative_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.md")
        .to_string();

    let has_fm = if frontmatter_raw.is_some() { 1 } else { 0 };

    conn.execute(
        "INSERT INTO files (
            workspace_id, relative_path, file_name, size_bytes, mtime_ms,
            hash_blake3, frontmatter_raw, has_frontmatter, is_deleted, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9)
         ON CONFLICT(relative_path) DO UPDATE SET
            size_bytes = excluded.size_bytes,
            mtime_ms = excluded.mtime_ms,
            hash_blake3 = excluded.hash_blake3,
            frontmatter_raw = excluded.frontmatter_raw,
            has_frontmatter = excluded.has_frontmatter,
            is_deleted = 0,
            updated_at = excluded.updated_at;",
        params![
            workspace_id,
            payload.relative_path,
            file_name,
            payload.size_bytes as i64,
            payload.mtime_ms as i64,
            payload.hash_blake3,
            frontmatter_raw,
            has_fm,
            now
        ],
    )
    .map_err(|e| format!("Failed to upsert file record: {e}"))?;

    let file_id: i64 = conn
        .query_row(
            "SELECT id FROM files WHERE relative_path = ?1",
            params![payload.relative_path],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to retrieve file id: {e}"))?;

    Ok(file_id)
}

pub fn mark_file_deleted(conn: &Connection, relative_path: &str) -> Result<(), String> {
    let now = now_ms();
    conn.execute(
        "UPDATE files SET is_deleted = 1, updated_at = ?1 WHERE relative_path = ?2;",
        params![now, relative_path],
    )
    .map_err(|e| format!("Failed to mark file deleted: {e}"))?;
    Ok(())
}

pub fn replace_file_blocks(
    conn: &mut Connection,
    file_id: i64,
    blocks: &[DbBlockRecord],
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start transaction: {e}"))?;

    tx.execute("DELETE FROM blocks WHERE file_id = ?1;", params![file_id])
        .map_err(|e| format!("Failed to clear old blocks: {e}"))?;

    let now = now_ms();
    for b in blocks {
        tx.execute(
            "INSERT INTO blocks (
                file_id, block_id, block_type, heading_level, start_line, end_line,
                start_char, end_char, content_hash, text_preview, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11);",
            params![
                file_id,
                b.block_id,
                b.block_type,
                b.heading_level,
                b.start_line,
                b.end_line,
                b.start_char,
                b.end_char,
                b.content_hash,
                b.text_preview,
                now
            ],
        )
        .map_err(|e| format!("Failed to insert block: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit block updates: {e}"))
}

pub fn replace_file_links(
    conn: &mut Connection,
    source_file_id: i64,
    links: &[DbLinkRecord],
) -> Result<(), String> {
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start link transaction: {e}"))?;

    tx.execute(
        "DELETE FROM links WHERE source_file_id = ?1;",
        params![source_file_id],
    )
    .map_err(|e| format!("Failed to clear old links: {e}"))?;

    let now = now_ms();
    for l in links {
        tx.execute(
            "INSERT INTO links (
                source_file_id, source_block_id, target_relative_path, target_file_id,
                target_block_id, link_type, link_text, line_number, is_broken, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10);",
            params![
                source_file_id,
                l.source_block_id,
                l.target_relative_path,
                l.target_file_id,
                l.target_block_id,
                l.link_type,
                l.link_text,
                l.line_number,
                if l.is_broken { 1 } else { 0 },
                now
            ],
        )
        .map_err(|e| format!("Failed to insert link: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit link replacements: {e}"))
}

pub fn sync_file_tags(
    conn: &mut Connection,
    file_id: i64,
    tag_names: &[String],
) -> Result<(), String> {
    let now = now_ms();
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start tag transaction: {e}"))?;

    tx.execute(
        "DELETE FROM file_tags WHERE file_id = ?1;",
        params![file_id],
    )
    .map_err(|e| format!("Failed to delete old file tags: {e}"))?;

    for tag in tag_names {
        let normalized = tag.trim_start_matches('#').to_lowercase();
        if normalized.is_empty() {
            continue;
        }

        tx.execute(
            "INSERT INTO tags (name, created_at) VALUES (?1, ?2)
             ON CONFLICT(name) DO NOTHING;",
            params![normalized, now],
        )
        .map_err(|e| format!("Failed to insert tag {normalized}: {e}"))?;

        let tag_id: i64 = tx
            .query_row(
                "SELECT id FROM tags WHERE name = ?1;",
                params![normalized],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to get tag id for {normalized}: {e}"))?;

        tx.execute(
            "INSERT OR IGNORE INTO file_tags (file_id, tag_id) VALUES (?1, ?2);",
            params![file_id, tag_id],
        )
        .map_err(|e| format!("Failed to bind file tag: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit tag sync: {e}"))
}

pub fn get_file_backlinks(
    conn: &Connection,
    target_relative_path: &str,
) -> Result<Vec<BacklinkItem>, String> {
    let target_file_name = std::path::Path::new(target_relative_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(target_relative_path);
    let target_stem = target_file_name.trim_end_matches(".md");

    let mut stmt = conn
        .prepare(
            "SELECT f.relative_path, f.file_name, l.line_number, l.link_text, l.target_block_id
             FROM links l
             JOIN files f ON l.source_file_id = f.id
             WHERE (
                l.target_relative_path = ?1
                OR l.target_relative_path = ?2
                OR l.target_relative_path = ?3
             )
             AND f.is_deleted = 0;",
        )
        .map_err(|e| format!("Failed to prepare backlink query: {e}"))?;

    let rows = stmt
        .query_map(
            params![target_relative_path, target_file_name, target_stem],
            |row| {
                let source_path: String = row.get(0)?;
                let source_name: String = row.get(1)?;
                let line_number: i32 = row.get(2)?;
                let link_text: String = row.get(3)?;
                let target_block_id: Option<String> = row.get(4)?;

                Ok(BacklinkItem {
                    source_file_path: source_path,
                    source_file_name: source_name,
                    line_number,
                    link_text,
                    target_block_id,
                    context_snippet: String::new(),
                })
            },
        )
        .map_err(|e| format!("Failed to query backlinks: {e}"))?;

    let mut results = Vec::new();
    for item in rows.flatten() {
        results.push(item);
    }

    Ok(results)
}

pub fn get_file_outlinks(
    conn: &Connection,
    source_relative_path: &str,
) -> Result<Vec<DbLinkRecord>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.id, l.source_file_id, f.relative_path, l.source_block_id,
                    l.target_relative_path, l.target_file_id, l.target_block_id,
                    l.link_type, l.link_text, l.line_number, l.is_broken, l.created_at
             FROM links l
             JOIN files f ON l.source_file_id = f.id
             WHERE f.relative_path = ?1;",
        )
        .map_err(|e| format!("Failed to prepare outlink query: {e}"))?;

    let rows = stmt
        .query_map(params![source_relative_path], |row| {
            Ok(DbLinkRecord {
                id: row.get(0)?,
                source_file_id: row.get(1)?,
                source_relative_path: row.get(2)?,
                source_block_id: row.get(3)?,
                target_relative_path: row.get(4)?,
                target_file_id: row.get(5)?,
                target_block_id: row.get(6)?,
                link_type: row.get(7)?,
                link_text: row.get(8)?,
                line_number: row.get(9)?,
                is_broken: row.get::<_, i32>(10)? == 1,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| format!("Failed to query outlinks: {e}"))?;

    let mut results = Vec::new();
    for item in rows.flatten() {
        results.push(item);
    }

    Ok(results)
}

pub fn list_tags(conn: &Connection) -> Result<Vec<TagCount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.name, COUNT(ft.file_id) as note_count
             FROM tags t
             LEFT JOIN file_tags ft ON t.id = ft.tag_id
             GROUP BY t.id, t.name
             ORDER BY note_count DESC, t.name ASC;",
        )
        .map_err(|e| format!("Failed to prepare tag count query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(TagCount {
                name: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query tag list: {e}"))?;

    let mut results = Vec::new();
    for item in rows.flatten() {
        results.push(item);
    }

    Ok(results)
}
