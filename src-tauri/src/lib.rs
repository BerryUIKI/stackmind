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
            commands::index::get_file_backlinks,
            commands::index::get_file_outlinks,
            commands::index::list_workspace_tags,
            commands::index::rebuild_workspace_index,
            commands::markdown::parse_document,
            commands::markdown::insert_block_anchor,
            commands::markdown::repair_links_on_rename,
            commands::search::search_workspace,
            commands::search::rebuild_search_index,
            commands::graph::get_workspace_graph_data,
            commands::graph::get_local_graph_data,
            commands::git::git_status,
            commands::git::git_diff,
            commands::git::git_commit,
            commands::git::git_log,
            commands::git::git_list_branches,
            commands::git::git_checkout_branch,
            commands::git::git_create_branch,
            commands::transclusion::resolve_transclusion,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stackmynd application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use models::db::{DbBlockRecord, DbLinkRecord};
    use models::fs::FilePayload;
    use models::workspace::WorkspaceMetadata;
    use services::db::{connection, indexer, rebuild, schema};
    use services::markdown::{
        block_anchor, block_parser, frontmatter, link_extractor, link_repair,
    };
    use services::search::{engine, schema::SearchSchema};
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
        assert_eq!(payload.hash_blake3.len(), 64);

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

    #[test]
    fn test_sqlite_schema_and_indexer() {
        let test_dir = tempfile::tempdir().unwrap();
        let db_path = test_dir.path().join("index.db");

        let mut conn = connection::open_db_at_path(&db_path).unwrap();
        schema::initialize_schema(&conn).unwrap();

        let ws_meta = WorkspaceMetadata {
            id: "ws-123".to_string(),
            name: "Test Workspace".to_string(),
            path: test_dir.path().to_string_lossy().to_string(),
            created_at: 1000,
            last_opened_at: 1000,
            version: "1.0.0".to_string(),
        };
        indexer::upsert_workspace(&conn, &ws_meta).unwrap();

        let payload_a = FilePayload {
            relative_path: "note_a.md".to_string(),
            content: "# Note A\nLinks to [[note_b]]".to_string(),
            size_bytes: 30,
            mtime_ms: 1000,
            hash_blake3: "hash_a".to_string(),
        };
        let file_a_id = indexer::upsert_file_record(&conn, "ws-123", &payload_a, None).unwrap();

        let payload_b = FilePayload {
            relative_path: "note_b.md".to_string(),
            content: "# Note B\nTarget file".to_string(),
            size_bytes: 20,
            mtime_ms: 1000,
            hash_blake3: "hash_b".to_string(),
        };
        let file_b_id = indexer::upsert_file_record(&conn, "ws-123", &payload_b, None).unwrap();

        // Add blocks for A
        let block_a = DbBlockRecord {
            id: 0,
            file_id: file_a_id,
            block_id: "bk-0001".to_string(),
            block_type: "heading".to_string(),
            heading_level: Some(1),
            start_line: 1,
            end_line: 1,
            start_char: 0,
            end_char: 8,
            content_hash: "hash_bk1".to_string(),
            text_preview: "Note A".to_string(),
            created_at: 1000,
            updated_at: 1000,
        };
        indexer::replace_file_blocks(&mut conn, file_a_id, &[block_a]).unwrap();

        // Add link from A to B
        let link_a_to_b = DbLinkRecord {
            id: 0,
            source_file_id: file_a_id,
            source_relative_path: "note_a.md".to_string(),
            source_block_id: None,
            target_relative_path: "note_b.md".to_string(),
            target_file_id: Some(file_b_id),
            target_block_id: None,
            link_type: "wikilink".to_string(),
            link_text: "note_b".to_string(),
            line_number: 2,
            is_broken: false,
            created_at: 1000,
        };
        indexer::replace_file_links(&mut conn, file_a_id, &[link_a_to_b]).unwrap();

        // Add tags to Note A
        indexer::sync_file_tags(
            &mut conn,
            file_a_id,
            &["#architecture".to_string(), "rust".to_string()],
        )
        .unwrap();

        // Query backlinks for note_b.md
        let backlinks = indexer::get_file_backlinks(&conn, "note_b.md").unwrap();
        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].source_file_path, "note_a.md");

        // Query outlinks for note_a.md
        let outlinks = indexer::get_file_outlinks(&conn, "note_a.md").unwrap();
        assert_eq!(outlinks.len(), 1);
        assert_eq!(outlinks[0].target_relative_path, "note_b.md");

        // Query tags
        let tags = indexer::list_tags(&conn).unwrap();
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0].name, "architecture");
    }

    #[test]
    fn test_full_rebuild_pipeline() {
        let test_dir = tempfile::tempdir().unwrap();
        let root = test_dir.path();

        let ws_meta = WorkspaceMetadata {
            id: "ws-rebuild".to_string(),
            name: "Rebuild WS".to_string(),
            path: root.to_string_lossy().to_string(),
            created_at: 1000,
            last_opened_at: 1000,
            version: "1.0.0".to_string(),
        };

        // Write some notes
        services::fs_service::atomic_write_file(root, "first.md", "# First note").unwrap();
        services::fs_service::atomic_write_file(root, "sub/second.md", "# Second note").unwrap();

        // Trigger rebuild
        rebuild::rebuild_workspace_index(root, &ws_meta).unwrap();

        // Verify index.db exists and contains records
        let conn = connection::open_db(root).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM files;", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_frontmatter_extraction_and_update() {
        let doc = "---\ntitle: My Note\ntags: [rust, tauri]\n---\n# Real Content\nParagraph.";
        let (raw, body) = frontmatter::extract_frontmatter(doc);
        assert!(raw.is_some());
        assert!(body.starts_with("# Real Content"));

        let (fields, tags) = frontmatter::parse_frontmatter(raw.as_ref().unwrap());
        assert_eq!(fields.get("title").unwrap().as_str().unwrap(), "My Note");
        assert_eq!(tags, vec!["rust", "tauri"]);

        let updated = frontmatter::update_frontmatter_value(doc, "title", "Renamed Title");
        assert!(updated.contains("title: Renamed Title"));
    }

    #[test]
    fn test_block_parsing_and_anchors() {
        let content = "# Header 1\n\nThis is a paragraph with anchor. ^bk-a1b2\n\n```rust\nfn main() {}\n```\n\n> Blockquote here";
        let doc = block_parser::parse_markdown_document(content);
        assert_eq!(doc.blocks.len(), 4);

        assert_eq!(doc.blocks[0].block_type, "heading");
        assert_eq!(doc.blocks[0].heading_level, Some(1));

        assert_eq!(doc.blocks[1].block_type, "paragraph");
        assert_eq!(doc.blocks[1].block_id, "bk-a1b2");

        assert_eq!(doc.blocks[2].block_type, "code");
        assert_eq!(doc.blocks[3].block_type, "blockquote");

        // Test stripping
        let stripped = block_anchor::strip_block_id("Some line ^bk-9999");
        assert_eq!(stripped, "Some line");

        // Test inserting anchor
        let (with_anchor, new_id) = block_anchor::insert_anchor_at_line("Plain text line", 1);
        assert!(with_anchor.contains(&format!("^{new_id}")));
    }

    #[test]
    fn test_link_extractor_and_repair() {
        let content =
            "Check [[note_b#Heading|My Alias]] and [[note_c#^bk-0001]] with #knowledge tag.";
        let (links, tags) = link_extractor::extract_links_and_tags(content);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].target_path, "note_b");
        assert_eq!(links[0].target_heading, Some("Heading".to_string()));
        assert_eq!(links[0].alias, Some("My Alias".to_string()));

        assert_eq!(links[1].target_path, "note_c");
        assert_eq!(links[1].target_block_id, Some("bk-0001".to_string()));

        assert_eq!(tags, vec!["knowledge"]);

        // Test workspace-wide link repair
        let test_dir = tempfile::tempdir().unwrap();
        let root = test_dir.path();

        services::fs_service::atomic_write_file(
            root,
            "referencing.md",
            "See [[old_name#^bk-123|Custom Alias]] for details.",
        )
        .unwrap();

        let repaired =
            link_repair::repair_workspace_links(root, "old_name.md", "new_name.md").unwrap();
        assert_eq!(repaired.len(), 1);
        assert_eq!(repaired[0].rewrites_count, 1);

        let modified = services::fs_service::read_file(root, "referencing.md").unwrap();
        assert_eq!(
            modified.content,
            "See [[new_name#^bk-123|Custom Alias]] for details."
        );
    }

    #[test]
    fn test_tantivy_search_engine() {
        let test_dir = tempfile::tempdir().unwrap();
        let search_dir = test_dir.path().join("search_index");

        let index = engine::open_or_create_index(&search_dir).unwrap();
        let schema_def = SearchSchema::new();

        let content = "# High Performance Systems\n\nStackmynd uses Tantivy for lightning fast local indexing.";
        let doc = block_parser::parse_markdown_document(content);

        let tags = vec!["systems".to_string(), "rust".to_string()];
        engine::index_document(
            &index,
            &schema_def,
            engine::DocumentToIndex {
                relative_path: "systems.md",
                title: "High Performance Systems",
                content,
                blocks: &doc.blocks,
                tags: &tags,
                mtime_ms: 1000,
            },
        )
        .unwrap();

        // Search general term
        let results = engine::search(&index, &schema_def, "lightning", 10).unwrap();
        assert!(!results.is_empty());
        assert_eq!(results[0].path, "systems.md");
        assert!(results[0].snippet.contains("lightning"));

        // Search tag
        let tag_results = engine::search(&index, &schema_def, "systems", 10).unwrap();
        assert!(!tag_results.is_empty());
    }

    #[test]
    fn test_knowledge_graph_extraction() {
        let test_dir = tempfile::tempdir().unwrap();
        let db_path = test_dir.path().join("index.db");

        let mut conn = connection::open_db_at_path(&db_path).unwrap();
        schema::initialize_schema(&conn).unwrap();

        let ws_meta = WorkspaceMetadata {
            id: "ws-graph".to_string(),
            name: "Graph WS".to_string(),
            path: test_dir.path().to_string_lossy().to_string(),
            created_at: 1000,
            last_opened_at: 1000,
            version: "1.0.0".to_string(),
        };
        indexer::upsert_workspace(&conn, &ws_meta).unwrap();

        // Note A
        let file_a_id = indexer::upsert_file_record(
            &conn,
            "ws-graph",
            &FilePayload {
                relative_path: "note_a.md".to_string(),
                content: "# Note A\n[[note_b]]".to_string(),
                size_bytes: 20,
                mtime_ms: 1000,
                hash_blake3: "hash_a".to_string(),
            },
            None,
        )
        .unwrap();

        // Note B
        let file_b_id = indexer::upsert_file_record(
            &conn,
            "ws-graph",
            &FilePayload {
                relative_path: "note_b.md".to_string(),
                content: "# Note B\nTarget note".to_string(),
                size_bytes: 20,
                mtime_ms: 1000,
                hash_blake3: "hash_b".to_string(),
            },
            None,
        )
        .unwrap();

        // Link A -> B
        let link_a_to_b = DbLinkRecord {
            id: 0,
            source_file_id: file_a_id,
            source_relative_path: "note_a.md".to_string(),
            source_block_id: None,
            target_relative_path: "note_b.md".to_string(),
            target_file_id: Some(file_b_id),
            target_block_id: None,
            link_type: "wikilink".to_string(),
            link_text: "note_b".to_string(),
            line_number: 2,
            is_broken: false,
            created_at: 1000,
        };
        indexer::replace_file_links(&mut conn, file_a_id, &[link_a_to_b]).unwrap();

        // Extract graph
        let graph = services::graph::service::get_workspace_graph(&conn, None).unwrap();
        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);
        assert_eq!(graph.edges[0].source, "note_a.md");
        assert_eq!(graph.edges[0].target, "note_b.md");

        // Test local graph from note_a.md
        let local_graph = services::graph::service::get_local_graph(&conn, "note_a.md", 1).unwrap();
        assert_eq!(local_graph.nodes.len(), 2);
    }

    #[test]
    fn test_git_service_lifecycle() {
        let test_dir = tempfile::tempdir().unwrap();
        let path = test_dir.path();

        // 1. Initial status before git init
        assert!(!services::git::service::is_git_repo(path));
        let status = services::git::service::get_status(path).unwrap();
        assert!(!status.is_repo);

        // 2. Initialize git repo
        std::process::Command::new("git")
            .args(["init", "-b", "main"])
            .current_dir(path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.name", "Test User"])
            .current_dir(path)
            .output()
            .unwrap();
        std::process::Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(path)
            .output()
            .unwrap();

        assert!(services::git::service::is_git_repo(path));

        // 3. Create a note and check status
        std::fs::write(path.join("note1.md"), "# Note 1\nHello Git!").unwrap();
        let status = services::git::service::get_status(path).unwrap();
        assert!(status.is_repo);
        assert!(!status.clean);
        assert_eq!(status.files.len(), 1);
        assert_eq!(status.files[0].path, "note1.md");
        assert_eq!(status.files[0].status, "untracked");

        // 4. Test diff
        let diff = services::git::service::get_diff(path, Some("note1.md")).unwrap();
        assert!(diff.contains("+Hello Git!"));

        // 5. Test commit
        let commit_res = services::git::service::commit(path, "Initial commit", true).unwrap();
        assert_eq!(commit_res.message, "Initial commit");
        assert!(!commit_res.commit_hash.is_empty());

        let status_after = services::git::service::get_status(path).unwrap();
        assert!(status_after.clean);

        // 6. Test log
        let logs = services::git::service::get_log(path, Some(10)).unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].message, "Initial commit");
        assert_eq!(logs[0].author, "Test User");

        // 7. Test branch creation & checkout
        services::git::service::create_branch(path, "feature-x").unwrap();
        let branches = services::git::service::list_branches(path).unwrap();
        assert_eq!(branches.current, "feature-x");
        assert_eq!(branches.branches.len(), 2);

        services::git::service::checkout_branch(path, "main").unwrap();
        let branches_main = services::git::service::list_branches(path).unwrap();
        assert_eq!(branches_main.current, "main");
    }

    #[test]
    fn test_transclusion_resolution() {
        let test_dir = tempfile::tempdir().unwrap();
        let ws_path = test_dir.path();

        // Create a target note with frontmatter, headings, and anchored blocks
        let note_content = r#"---
title: Source Note
tags: [math, logic]
---

# Introduction
This is the introduction paragraph.

## Quantum Entanglement
Quantum entanglement is a physical phenomenon. ^bk-qent

Here is another paragraph after the block.

## Classical Mechanics
This is about classical physics.
"#;
        std::fs::write(ws_path.join("source.md"), note_content).unwrap();

        // 1. Test full document transclusion (frontmatter stripped)
        let doc_res = services::transclusion::TransclusionService::resolve_transclusion(
            ws_path, "source", None, None,
        )
        .unwrap();
        assert!(doc_res.exists);
        assert!(!doc_res.content.contains("title: Source Note"));
        assert!(doc_res.content.contains("# Introduction"));
        assert!(
            doc_res
                .content
                .contains("Quantum entanglement is a physical phenomenon.")
        );

        // 2. Test block transclusion with ^bk-qent
        let block_res = services::transclusion::TransclusionService::resolve_transclusion(
            ws_path,
            "source",
            Some("^bk-qent"),
            None,
        )
        .unwrap();
        assert!(block_res.exists);
        assert_eq!(block_res.block_id, Some("bk-qent".to_string()));
        assert!(
            block_res
                .content
                .contains("Quantum entanglement is a physical phenomenon.")
        );
        assert!(!block_res.content.contains("^bk-qent")); // anchor stripped

        // 3. Test heading section transclusion
        let heading_res = services::transclusion::TransclusionService::resolve_transclusion(
            ws_path,
            "source",
            None,
            Some("Quantum Entanglement"),
        )
        .unwrap();
        assert!(heading_res.exists);
        assert!(
            heading_res
                .content
                .contains("Quantum entanglement is a physical phenomenon.")
        );
        assert!(!heading_res.content.contains("Classical Mechanics")); // stopped at next heading of equal level

        // 4. Test non-existent file
        let not_found = services::transclusion::TransclusionService::resolve_transclusion(
            ws_path,
            "does_not_exist",
            None,
            None,
        )
        .unwrap();
        assert!(!not_found.exists);
    }
}
