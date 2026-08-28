use rusqlite::Connection;

pub const CURRENT_SCHEMA_VERSION: i32 = 1;

pub fn initialize_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "BEGIN;

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY NOT NULL,
            path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            schema_version INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            last_opened_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT NOT NULL,
            relative_path TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            mtime_ms INTEGER NOT NULL,
            hash_blake3 TEXT NOT NULL,
            frontmatter_raw TEXT NULL,
            has_frontmatter INTEGER NOT NULL DEFAULT 0,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_id INTEGER NOT NULL,
            block_id TEXT NOT NULL,
            block_type TEXT NOT NULL,
            heading_level INTEGER NULL,
            start_line INTEGER NOT NULL,
            end_line INTEGER NOT NULL,
            start_char INTEGER NOT NULL,
            end_char INTEGER NOT NULL,
            content_hash TEXT NOT NULL,
            text_preview TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file_id INTEGER NOT NULL,
            source_block_id INTEGER NULL,
            target_relative_path TEXT NOT NULL,
            target_file_id INTEGER NULL,
            target_block_id TEXT NULL,
            link_type TEXT NOT NULL,
            link_text TEXT NOT NULL,
            line_number INTEGER NOT NULL,
            is_broken INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (source_file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (source_block_id) REFERENCES blocks(id) ON DELETE SET NULL,
            FOREIGN KEY (target_file_id) REFERENCES files(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS file_tags (
            file_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (file_id, tag_id),
            FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS block_tags (
            block_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (block_id, tag_id),
            FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS recycle_bin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_relative_path TEXT NOT NULL,
            trash_filename TEXT NOT NULL UNIQUE,
            file_size_bytes INTEGER NOT NULL,
            deleted_at INTEGER NOT NULL
        );

        -- Performance Indexes
        CREATE INDEX IF NOT EXISTS idx_files_relative_path ON files(relative_path);
        CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime_ms);
        CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash_blake3);

        CREATE INDEX IF NOT EXISTS idx_blocks_file_id ON blocks(file_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_block_id ON blocks(block_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_lookup ON blocks(file_id, block_id);

        CREATE INDEX IF NOT EXISTS idx_links_source_file ON links(source_file_id);
        CREATE INDEX IF NOT EXISTS idx_links_target_path ON links(target_relative_path);
        CREATE INDEX IF NOT EXISTS idx_links_target_block ON links(target_block_id);
        CREATE INDEX IF NOT EXISTS idx_links_target_resolved ON links(target_file_id);

        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_block_tags_tag ON block_tags(tag_id);

        COMMIT;",
    )
    .map_err(|e| format!("Failed to initialize SQLite schema: {e}"))
}
