use crate::models::markdown::RepairedFileResult;
use crate::services::fs_service::{self, read_directory_tree};
use std::path::Path;

/// Recursively scans workspace notes, finds all wikilinks referencing `old_path` or its stem,
/// rewrites them to `new_path`, and saves via atomic file writes.
pub fn repair_workspace_links(
    workspace_root: &Path,
    old_path: &str,
    new_path: &str,
) -> Result<Vec<RepairedFileResult>, String> {
    let old_filename = Path::new(old_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(old_path);
    let old_stem = old_filename.trim_end_matches(".md");

    let new_filename = Path::new(new_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(new_path);
    let new_stem = new_filename.trim_end_matches(".md");

    let nodes = read_directory_tree(workspace_root, "")?;
    let mut md_paths = Vec::new();
    collect_md_files(&nodes, &mut md_paths);

    let mut results = Vec::new();

    for rel_path in md_paths {
        if rel_path == old_path || rel_path == new_path {
            continue;
        }

        if let Ok(payload) = fs_service::read_file(workspace_root, &rel_path) {
            let (repaired_content, count) =
                rewrite_wikilinks(&payload.content, old_path, old_filename, old_stem, new_stem);

            if count > 0 {
                let _ =
                    fs_service::atomic_write_file(workspace_root, &rel_path, &repaired_content)?;
                results.push(RepairedFileResult {
                    file_path: rel_path,
                    rewrites_count: count,
                });
            }
        }
    }

    Ok(results)
}

fn rewrite_wikilinks(
    content: &str,
    old_path: &str,
    old_filename: &str,
    old_stem: &str,
    new_stem: &str,
) -> (String, usize) {
    let mut result = String::with_capacity(content.len());
    let mut count = 0;
    let mut search_start = 0;

    while let Some(start) = content[search_start..].find("[[") {
        let actual_start = search_start + start;
        result.push_str(&content[search_start..actual_start]);

        if let Some(end) = content[actual_start..].find("]]") {
            let full_link = &content[actual_start..actual_start + end + 2];
            let inner = &content[actual_start + 2..actual_start + end];

            let (target_part, alias_part) = if let Some(pipe_idx) = inner.find('|') {
                (&inner[..pipe_idx], Some(&inner[pipe_idx..]))
            } else {
                (inner, None)
            };

            let (target_file, fragment) = if let Some(hash_idx) = target_part.find('#') {
                (&target_part[..hash_idx], Some(&target_part[hash_idx..]))
            } else {
                (target_part, None)
            };

            let target_trimmed = target_file.trim();
            if target_trimmed == old_path
                || target_trimmed == old_filename
                || target_trimmed == old_stem
            {
                // Perform rewrite
                let mut rewritten = String::from("[[");
                rewritten.push_str(new_stem);
                if let Some(frag) = fragment {
                    rewritten.push_str(frag);
                }
                if let Some(alias) = alias_part {
                    rewritten.push_str(alias);
                }
                rewritten.push_str("]]");

                result.push_str(&rewritten);
                count += 1;
            } else {
                result.push_str(full_link);
            }

            search_start = actual_start + end + 2;
        } else {
            result.push_str(&content[actual_start..]);
            search_start = content.len();
            break;
        }
    }

    if search_start < content.len() {
        result.push_str(&content[search_start..]);
    }

    (result, count)
}

fn collect_md_files(nodes: &[crate::models::fs::FileNode], out: &mut Vec<String>) {
    for n in nodes {
        if n.is_dir {
            if let Some(ref children) = n.children {
                collect_md_files(children, out);
            }
        } else if n.name.ends_with(".md") || n.name.ends_with(".markdown") {
            out.push(n.relative_path.clone());
        }
    }
}
