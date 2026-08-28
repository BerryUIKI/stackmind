use crate::services::fs_service::calculate_blake3;

/// Extract trailing block anchor ID like `^bk-xxxx` from block text.
pub fn extract_block_id(text: &str) -> Option<String> {
    let trimmed = text.trim_end();
    if let Some(idx) = trimmed.rfind('^') {
        let candidate = &trimmed[idx + 1..];
        if candidate.len() >= 4
            && candidate.len() <= 16
            && candidate
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            // Verify there is whitespace before the anchor or it's at start
            if idx == 0 || trimmed[..idx].ends_with(|c: char| c.is_whitespace()) {
                return Some(candidate.to_string());
            }
        }
    }
    None
}

/// Strips trailing block anchor ` ^bk-xxxx` from content for clean preview/rendering.
pub fn strip_block_id(text: &str) -> String {
    let trimmed = text.trim_end();
    if let Some(idx) = trimmed.rfind('^') {
        let candidate = &trimmed[idx + 1..];
        if candidate.len() >= 4
            && candidate.len() <= 16
            && candidate
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
            && idx > 0
            && trimmed[..idx].ends_with(|c: char| c.is_whitespace())
        {
            return trimmed[..idx].trim_end().to_string();
        }
    }
    text.to_string()
}

/// Generates a deterministic block ID `bk-xxxx` based on content seed and index.
pub fn generate_deterministic_block_id(seed: &str, line: usize) -> String {
    let full_hash = calculate_blake3(format!("{seed}:{line}").as_bytes());
    let short_hash = &full_hash[..4];
    format!("bk-{}", short_hash)
}

/// Inserts a block anchor ` ^bk-xxxx` on a target 1-indexed line.
pub fn insert_anchor_at_line(content: &str, target_line: usize) -> (String, String) {
    let lines: Vec<&str> = content.lines().collect();
    if target_line == 0 || target_line > lines.len() {
        let new_id = generate_deterministic_block_id(content, target_line);
        let mut updated = content.to_string();
        if !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str(&format!(" ^{new_id}\n"));
        return (updated, new_id);
    }

    let target_idx = target_line - 1;
    let current_line = lines[target_idx];

    // If anchor already exists, return existing
    if let Some(existing_id) = extract_block_id(current_line) {
        return (content.to_string(), existing_id);
    }

    let new_id = generate_deterministic_block_id(current_line, target_line);
    let mut updated_lines = Vec::with_capacity(lines.len());

    for (i, line) in lines.iter().enumerate() {
        if i == target_idx {
            updated_lines.push(format!("{line} ^{new_id}"));
        } else {
            updated_lines.push(line.to_string());
        }
    }

    let mut result = updated_lines.join("\n");
    if content.ends_with('\n') {
        result.push('\n');
    }

    (result, new_id)
}
