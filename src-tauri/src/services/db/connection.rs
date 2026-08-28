use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn open_db(workspace_root: &Path) -> Result<Connection, String> {
    let db_dir = workspace_root.join(".stackmynd");
    fs::create_dir_all(&db_dir)
        .map_err(|e| format!("Failed to create .stackmynd directory: {e}"))?;

    let db_path = db_dir.join("index.db");
    open_db_at_path(&db_path)
}

pub fn open_db_at_path(db_path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open SQLite database at {:?}: {e}", db_path))?;

    // Apply strict performance and integrity pragmas per architecture specification
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;
         PRAGMA temp_store = MEMORY;
         PRAGMA cache_size = -64000;",
    )
    .map_err(|e| format!("Failed to apply SQLite pragmas: {e}"))?;

    Ok(conn)
}
