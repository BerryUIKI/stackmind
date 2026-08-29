use crate::models::transclusion::TransclusionPayload;
use crate::services::markdown::block_anchor::strip_block_id;
use crate::services::markdown::block_parser::slice_markdown_blocks;
use crate::services::markdown::frontmatter::extract_frontmatter;
use std::fs;
use std::path::{Path, PathBuf};

pub struct TransclusionService;

impl TransclusionService {
    pub fn resolve_transclusion(
        root: &Path,
        target_path: &str,
        block_id: Option<&str>,
        heading: Option<&str>,
    ) -> Result<TransclusionPayload, String> {
        // Normalize target file path
        let rel_target = target_path.trim().replace('\\', "/");
        let file_rel = if rel_target.ends_with(".md") {
            rel_target.clone()
        } else {
            format!("{}.md", rel_target)
        };

        let candidate_path = root.join(&file_rel);
        let target_file_path = if candidate_path.exists() && candidate_path.is_file() {
            Some(candidate_path)
        } else {
            // Search file in workspace by relative name or basename
            find_file_in_workspace(root, &file_rel)
        };

        let file_path = match target_file_path {
            Some(p) => p,
            None => {
                return Ok(TransclusionPayload {
                    resolved_path: file_rel,
                    title: extract_title_from_path(&rel_target),
                    block_id: block_id.map(|s| s.to_string()),
                    heading: heading.map(|s| s.to_string()),
                    content: String::new(),
                    exists: false,
                    is_circular: false,
                });
            }
        };

        // Read target file content
        let full_text = fs::read_to_string(&file_path).map_err(|e| {
            format!(
                "Failed to read target note '{}': {}",
                file_path.display(),
                e
            )
        })?;

        let relative_resolved = file_path
            .strip_prefix(root)
            .unwrap_or(&file_path)
            .to_string_lossy()
            .replace('\\', "/");

        let title = extract_title_from_path(&relative_resolved);

        // 1. If block_id is requested, find the matching block
        if let Some(bid) = block_id {
            let normalized_bid = if let Some(stripped) = bid.strip_prefix('^') {
                stripped
            } else {
                bid
            };

            let (_, body) = extract_frontmatter(&full_text);
            let blocks = slice_markdown_blocks(&body);

            for block in blocks {
                if block.block_id == normalized_bid
                    || block.block_id == format!("^{}", normalized_bid)
                {
                    let cleaned = strip_block_id(&block.content);
                    return Ok(TransclusionPayload {
                        resolved_path: relative_resolved,
                        title,
                        block_id: Some(normalized_bid.to_string()),
                        heading: None,
                        content: cleaned.trim().to_string(),
                        exists: true,
                        is_circular: false,
                    });
                }
            }

            // Block not found
            return Ok(TransclusionPayload {
                resolved_path: relative_resolved,
                title,
                block_id: Some(normalized_bid.to_string()),
                heading: None,
                content: String::new(),
                exists: false,
                is_circular: false,
            });
        }

        // 2. If heading is requested, slice from heading to next same-or-higher heading
        if let Some(target_heading) = heading {
            let (_, body) = extract_frontmatter(&full_text);
            if let Some(heading_content) = slice_heading_section(&body, target_heading) {
                return Ok(TransclusionPayload {
                    resolved_path: relative_resolved,
                    title,
                    block_id: None,
                    heading: Some(target_heading.to_string()),
                    content: heading_content,
                    exists: true,
                    is_circular: false,
                });
            } else {
                return Ok(TransclusionPayload {
                    resolved_path: relative_resolved,
                    title,
                    block_id: None,
                    heading: Some(target_heading.to_string()),
                    content: String::new(),
                    exists: false,
                    is_circular: false,
                });
            }
        }

        // 3. Otherwise, return entire document body (excluding frontmatter)
        let (_, body) = extract_frontmatter(&full_text);
        Ok(TransclusionPayload {
            resolved_path: relative_resolved,
            title,
            block_id: None,
            heading: None,
            content: body.trim().to_string(),
            exists: true,
            is_circular: false,
        })
    }
}

fn extract_title_from_path(path: &str) -> String {
    let p = Path::new(path);
    p.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn find_file_in_workspace(root: &Path, rel_name: &str) -> Option<PathBuf> {
    let target_name = Path::new(rel_name)
        .file_name()?
        .to_string_lossy()
        .to_lowercase();

    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();

                if file_name.starts_with('.') {
                    continue;
                }

                if path.is_dir() {
                    stack.push(path);
                } else if path.is_file() && file_name.to_lowercase() == target_name {
                    return Some(path);
                }
            }
        }
    }

    None
}

fn slice_heading_section(body: &str, target_heading: &str) -> Option<String> {
    let lines: Vec<&str> = body.lines().collect();
    let target_clean = target_heading.trim().to_lowercase();

    let mut found_idx = None;
    let mut heading_level = 0;

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            let hashes = trimmed.chars().take_while(|&c| c == '#').count();
            if (1..=6).contains(&hashes) {
                let rest = trimmed[hashes..].trim().to_lowercase();
                if rest == target_clean {
                    found_idx = Some(idx);
                    heading_level = hashes;
                    break;
                }
            }
        }
    }

    let start_idx = found_idx?;
    let mut end_idx = lines.len();

    for (offset, line) in lines[start_idx + 1..].iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') {
            let hashes = trimmed.chars().take_while(|&c| c == '#').count();
            if hashes >= 1 && hashes <= heading_level {
                end_idx = start_idx + 1 + offset;
                break;
            }
        }
    }

    let section = lines[start_idx..end_idx].join("\n");
    Some(section.trim().to_string())
}
