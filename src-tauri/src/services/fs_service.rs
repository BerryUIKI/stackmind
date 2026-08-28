use crate::models::fs::{FileNode, FilePayload, TrashRecord};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Verifies that a relative path stays strictly within the workspace root boundary.
pub fn sanitize_path(workspace_root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative_path);
    // Disallow absolute paths and traversal components
    for comp in rel.components() {
        match comp {
            Component::ParentDir => return Err("Directory traversal (..) is forbidden".to_string()),
            Component::RootDir | Component::Prefix(_) => {
                return Err("Absolute path components are forbidden".to_string());
            }
            _ => {}
        }
    }
    let target = workspace_root.join(rel);
    Ok(target)
}

pub fn calculate_blake3(data: &[u8]) -> String {
    let mut hasher = blake3::Hasher::new();
    hasher.update(data);
    hasher.finalize().to_hex().to_string()
}

pub fn get_mtime_ms(meta: &fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Executes crash-resilient atomic file write:
/// 1. Write to sibling temporary file: `<dir>/.<filename>.tmp.<uuid>`
/// 2. Call fsync / sync_all() on file handle to ensure physical storage persistence
/// 3. Atomic rename / swap over target file
pub fn atomic_write_file(
    workspace_root: &Path,
    relative_path: &str,
    content: &str,
) -> Result<FilePayload, String> {
    let target_path = sanitize_path(workspace_root, relative_path)?;
    let parent_dir = target_path
        .parent()
        .ok_or_else(|| "Target path has no parent directory".to_string())?;

    fs::create_dir_all(parent_dir)
        .map_err(|e| format!("Failed to create parent directories: {e}"))?;

    let file_name = target_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");

    let tmp_file_name = format!(".{}.tmp.{}", file_name, Uuid::new_v4());
    let tmp_path = parent_dir.join(&tmp_file_name);

    {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&tmp_path)
            .map_err(|e| format!("Failed to create temporary file: {e}"))?;

        file.write_all(content.as_bytes())
            .map_err(|e| format!("Failed to write to temporary file: {e}"))?;

        file.sync_all()
            .map_err(|e| format!("Failed to fsync temporary file: {e}"))?;
    }

    fs::rename(&tmp_path, &target_path).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        format!("Failed to atomically rename file: {e}")
    })?;

    let meta = fs::metadata(&target_path)
        .map_err(|e| format!("Failed to read written file metadata: {e}"))?;

    let hash_blake3 = calculate_blake3(content.as_bytes());

    Ok(FilePayload {
        relative_path: relative_path.replace('\\', "/"),
        content: content.to_string(),
        size_bytes: meta.len(),
        mtime_ms: get_mtime_ms(&meta),
        hash_blake3,
    })
}

pub fn read_file(workspace_root: &Path, relative_path: &str) -> Result<FilePayload, String> {
    let target_path = sanitize_path(workspace_root, relative_path)?;
    let mut file = File::open(&target_path).map_err(|e| format!("Failed to open file: {e}"))?;

    let meta = file
        .metadata()
        .map_err(|e| format!("Failed to read metadata: {e}"))?;

    let mut content = String::new();
    file.read_to_string(&mut content)
        .map_err(|e| format!("Failed to read file as UTF-8: {e}"))?;

    let hash_blake3 = calculate_blake3(content.as_bytes());

    Ok(FilePayload {
        relative_path: relative_path.replace('\\', "/"),
        content,
        size_bytes: meta.len(),
        mtime_ms: get_mtime_ms(&meta),
        hash_blake3,
    })
}

pub fn create_file(
    workspace_root: &Path,
    relative_path: &str,
    initial_content: &str,
) -> Result<FilePayload, String> {
    let target = sanitize_path(workspace_root, relative_path)?;
    if target.exists() {
        return Err(format!(
            "File already exists at relative path: {relative_path}"
        ));
    }
    atomic_write_file(workspace_root, relative_path, initial_content)
}

pub fn create_directory(workspace_root: &Path, relative_path: &str) -> Result<(), String> {
    let target = sanitize_path(workspace_root, relative_path)?;
    fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {e}"))
}

pub fn rename_path(
    workspace_root: &Path,
    old_relative_path: &str,
    new_relative_path: &str,
) -> Result<(), String> {
    let old_target = sanitize_path(workspace_root, old_relative_path)?;
    let new_target = sanitize_path(workspace_root, new_relative_path)?;

    if !old_target.exists() {
        return Err(format!("Source path does not exist: {old_relative_path}"));
    }
    if new_target.exists() {
        return Err(format!(
            "Destination path already exists: {new_relative_path}"
        ));
    }

    if let Some(parent) = new_target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory for rename: {e}"))?;
    }

    fs::rename(old_target, new_target).map_err(|e| format!("Failed to rename path: {e}"))
}

pub fn read_directory_tree(
    workspace_root: &Path,
    relative_subpath: &str,
) -> Result<Vec<FileNode>, String> {
    let base_dir = sanitize_path(workspace_root, relative_subpath)?;
    if !base_dir.is_dir() {
        return Err(format!("Path is not a directory: {relative_subpath}"));
    }

    let mut nodes = Vec::new();
    let entries = fs::read_dir(&base_dir).map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Ignore hidden directories like .stackmynd, .git, or system files
        if file_name.starts_with('.') {
            continue;
        }

        let is_dir = path.is_dir();
        let meta = entry.metadata().ok();
        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let mtime_ms = meta.as_ref().map(get_mtime_ms).unwrap_or(0);

        let relative_path = path
            .strip_prefix(workspace_root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_else(|_| file_name.clone());

        if is_dir {
            let children = read_directory_tree(workspace_root, &relative_path).ok();
            nodes.push(FileNode {
                name: file_name,
                relative_path,
                is_dir: true,
                size_bytes,
                mtime_ms,
                children,
            });
        } else if file_name.ends_with(".md") || file_name.ends_with(".markdown") {
            nodes.push(FileNode {
                name: file_name,
                relative_path,
                is_dir: false,
                size_bytes,
                mtime_ms,
                children: None,
            });
        }
    }

    // Sort: directories first (case-insensitive), then files (case-insensitive)
    nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(nodes)
}

/// Moves a file to the workspace's local recycle bin (.stackmynd/trash/)
pub fn delete_to_trash(workspace_root: &Path, relative_path: &str) -> Result<TrashRecord, String> {
    let source_path = sanitize_path(workspace_root, relative_path)?;
    if !source_path.exists() {
        return Err(format!("File does not exist: {relative_path}"));
    }

    let trash_dir = workspace_root.join(".stackmynd").join("trash");
    fs::create_dir_all(&trash_dir).map_err(|e| format!("Failed to create trash directory: {e}"))?;

    let meta =
        fs::metadata(&source_path).map_err(|e| format!("Failed to read file metadata: {e}"))?;

    let file_id = Uuid::new_v4().to_string();
    let file_stem = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("deleted_file");
    let trash_filename = format!("{}-{}", file_id, file_stem);
    let trash_target = trash_dir.join(&trash_filename);

    fs::rename(&source_path, &trash_target)
        .map_err(|e| format!("Failed to move file to trash: {e}"))?;

    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let record = TrashRecord {
        id: file_id,
        original_relative_path: relative_path.replace('\\', "/"),
        trash_filename,
        file_size_bytes: meta.len(),
        deleted_at: now_ms,
    };

    // Save tombstone metadata to .stackmynd/trash/metadata.json
    let meta_file = trash_dir.join("metadata.json");
    let mut records: Vec<TrashRecord> = if meta_file.exists() {
        fs::read_to_string(&meta_file)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    records.push(record.clone());
    let _ = fs::write(
        &meta_file,
        serde_json::to_string_pretty(&records).unwrap_or_default(),
    );

    Ok(record)
}

pub fn list_trash(workspace_root: &Path) -> Result<Vec<TrashRecord>, String> {
    let meta_file = workspace_root
        .join(".stackmynd")
        .join("trash")
        .join("metadata.json");
    if !meta_file.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&meta_file)
        .map_err(|e| format!("Failed to read trash metadata: {e}"))?;
    let records: Vec<TrashRecord> = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse trash metadata: {e}"))?;
    Ok(records)
}

pub fn restore_from_trash(
    workspace_root: &Path,
    trash_filename: &str,
    original_relative_path: &str,
) -> Result<(), String> {
    let trash_dir = workspace_root.join(".stackmynd").join("trash");
    let trash_path = trash_dir.join(trash_filename);
    if !trash_path.exists() {
        return Err(format!("Trash file does not exist: {trash_filename}"));
    }

    let target_path = sanitize_path(workspace_root, original_relative_path)?;
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to recreate folder structure: {e}"))?;
    }

    fs::rename(&trash_path, &target_path)
        .map_err(|e| format!("Failed to restore file from trash: {e}"))?;

    // Remove from metadata.json
    let meta_file = trash_dir.join("metadata.json");
    if meta_file.exists() {
        if let Ok(content) = fs::read_to_string(&meta_file) {
            if let Ok(mut records) = serde_json::from_str::<Vec<TrashRecord>>(&content) {
                records.retain(|r| r.trash_filename != trash_filename);
                let _ = fs::write(
                    &meta_file,
                    serde_json::to_string_pretty(&records).unwrap_or_default(),
                );
            }
        }
    }

    Ok(())
}

pub fn empty_trash(workspace_root: &Path) -> Result<(), String> {
    let trash_dir = workspace_root.join(".stackmynd").join("trash");
    if trash_dir.exists() {
        fs::remove_dir_all(&trash_dir)
            .map_err(|e| format!("Failed to empty trash directory: {e}"))?;
        fs::create_dir_all(&trash_dir)
            .map_err(|e| format!("Failed to reinitialize empty trash directory: {e}"))?;
    }
    Ok(())
}
