pub mod commands;
pub mod models;
pub mod services;
pub mod state;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping::ping,
            commands::workspace::init_or_open_workspace,
            commands::workspace::get_active_workspace,
            commands::workspace::list_workspaces,
            commands::workspace::remove_workspace,
            commands::workspace::save_workspace_session,
            commands::workspace::load_workspace_session,
            commands::fs::read_directory,
            commands::fs::read_file,
            commands::fs::write_file_atomic,
            commands::fs::create_file,
            commands::fs::create_directory,
            commands::fs::rename_path,
            commands::fs::delete_to_trash,
            commands::fs::restore_from_trash,
            commands::fs::list_trash,
            commands::fs::empty_trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stackmynd application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    #[test]
    fn test_ping_response() {
        let res = commands::ping::ping();
        assert!(res.message.contains("pong"));
        assert!(res.timestamp > 0);
    }

    #[test]
    fn test_sandbox_path_validation() {
        let root = Path::new("/tmp/test_workspace");
        let safe = services::fs_service::sanitize_path(root, "docs/note.md").unwrap();
        assert_eq!(safe, root.join("docs/note.md"));

        let traversal = services::fs_service::sanitize_path(root, "../escaping.md");
        assert!(traversal.is_err());

        let absolute = services::fs_service::sanitize_path(root, "/etc/passwd");
        assert!(absolute.is_err());
    }

    #[test]
    fn test_atomic_file_write_and_read() {
        let test_dir = tempfile::tempdir().unwrap();
        let root = test_dir.path();

        let payload = services::fs_service::atomic_write_file(
            root,
            "subfolder/test_note.md",
            "# Hello Stackmynd\n\nAtomic write test.",
        )
        .unwrap();

        assert_eq!(payload.relative_path, "subfolder/test_note.md");
        assert!(payload.hash_blake3.len() == 64);

        // Read back
        let read = services::fs_service::read_file(root, "subfolder/test_note.md").unwrap();
        assert_eq!(read.content, "# Hello Stackmynd\n\nAtomic write test.");
        assert_eq!(read.hash_blake3, payload.hash_blake3);

        // Ensure no leftover temp files
        let parent = root.join("subfolder");
        for entry in fs::read_dir(parent).unwrap().flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            assert!(!name.contains(".tmp."));
        }
    }

    #[test]
    fn test_trash_and_restore_lifecycle() {
        let test_dir = tempfile::tempdir().unwrap();
        let root = test_dir.path();

        services::fs_service::atomic_write_file(root, "notes/delete_me.md", "Content to trash")
            .unwrap();

        // Delete to trash
        let trash_rec = services::fs_service::delete_to_trash(root, "notes/delete_me.md").unwrap();
        assert_eq!(trash_rec.original_relative_path, "notes/delete_me.md");
        assert!(!root.join("notes/delete_me.md").exists());

        // Verify listed in trash
        let list = services::fs_service::list_trash(root).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, trash_rec.id);

        // Restore
        services::fs_service::restore_from_trash(
            root,
            &trash_rec.trash_filename,
            &trash_rec.original_relative_path,
        )
        .unwrap();
        assert!(root.join("notes/delete_me.md").exists());

        let restored = services::fs_service::read_file(root, "notes/delete_me.md").unwrap();
        assert_eq!(restored.content, "Content to trash");
    }

    #[test]
    fn test_self_write_suppression_registry() {
        let registry = services::watcher_service::SelfWriteRegistry::new();
        let path = Path::new("/workspace/test.md");
        let hash = "fake_blake3_hash";

        registry.register(path, hash);
        assert!(registry.is_self_write(path));
        // Second check should be false because it was consumed
        assert!(!registry.is_self_write(path));
    }
}
