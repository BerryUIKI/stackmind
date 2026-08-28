use crate::models::markdown::ParsedLink;

/// Extracts all wikilinks, markdown links, and inline tags from markdown text line by line.
pub fn extract_links_and_tags(content: &str) -> (Vec<ParsedLink>, Vec<String>) {
    let mut links = Vec::new();
    let mut tags = Vec::new();
    let mut in_code_block = false;

    for (line_idx, line) in content.lines().enumerate() {
        let line_num = (line_idx + 1) as i32;
        let trimmed = line.trim();

        if trimmed.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }

        if in_code_block {
            continue;
        }

        // 1. Extract Wikilinks: [[target]]
        let mut search_start = 0;
        while let Some(start) = line[search_start..].find("[[") {
            let actual_start = search_start + start;
            if let Some(end) = line[actual_start..].find("]]") {
                let inner = &line[actual_start + 2..actual_start + end];
                let (target_part, alias) = if let Some(pipe_idx) = inner.find('|') {
                    (&inner[..pipe_idx], Some(inner[pipe_idx + 1..].to_string()))
                } else {
                    (inner, None)
                };

                let (target_path, target_heading, target_block_id) =
                    parse_wikilink_target(target_part);

                links.push(ParsedLink {
                    target_path,
                    target_block_id,
                    target_heading,
                    alias,
                    link_text: inner.to_string(),
                    line_number: line_num,
                    is_wikilink: true,
                });

                search_start = actual_start + end + 2;
            } else {
                break;
            }
        }

        // 2. Extract Inline Tags: #tag (excluding markdown headings like "# Title")
        if !trimmed.starts_with('#') || trimmed.starts_with("##") && !trimmed.starts_with("###") {
            // Check if it's a markdown heading: "# text" or "## text"
            let is_heading = trimmed.starts_with('#')
                && trimmed
                    .chars()
                    .find(|c| *c != '#')
                    .map(|c| c.is_whitespace())
                    .unwrap_or(false);

            if !is_heading {
                extract_tags_from_line(line, &mut tags);
            }
        }
    }

    tags.sort();
    tags.dedup();

    (links, tags)
}

fn parse_wikilink_target(raw: &str) -> (String, Option<String>, Option<String>) {
    if let Some(hash_idx) = raw.find('#') {
        let path = raw[..hash_idx].trim().to_string();
        let fragment = &raw[hash_idx + 1..];
        if let Some(stripped) = fragment.strip_prefix('^') {
            (path, None, Some(stripped.to_string()))
        } else {
            (path, Some(fragment.to_string()), None)
        }
    } else {
        (raw.trim().to_string(), None, None)
    }
}

fn extract_tags_from_line(line: &str, tags: &mut Vec<String>) {
    let mut chars = line.char_indices().peekable();
    while let Some((idx, ch)) = chars.next() {
        if ch == '#' {
            // Verify tag is preceded by whitespace, start of line, or punctuation
            let valid_start = if idx == 0 {
                true
            } else {
                line[..idx]
                    .chars()
                    .last()
                    .map(|prev| prev.is_whitespace() || prev == '(' || prev == '[' || prev == '{')
                    .unwrap_or(false)
            };

            if valid_start {
                let tag_candidate: String = chars
                    .by_ref()
                    .take_while(|(_, c)| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == '/')
                    .map(|(_, c)| c)
                    .collect();

                // Tags must be at least 1 character and not purely numbers
                if !tag_candidate.is_empty() && !tag_candidate.chars().all(|c| c.is_ascii_digit()) {
                    tags.push(tag_candidate.to_lowercase());
                }
            }
        }
    }
}
