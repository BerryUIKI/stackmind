use crate::models::markdown::{ParsedBlock, ParsedDocument};
use crate::services::fs_service::calculate_blake3;
use crate::services::markdown::block_anchor::{
    extract_block_id, generate_deterministic_block_id, strip_block_id,
};
use crate::services::markdown::frontmatter::{extract_frontmatter, parse_frontmatter};
use crate::services::markdown::link_extractor::extract_links_and_tags;

pub fn parse_markdown_document(content: &str) -> ParsedDocument {
    let (frontmatter_raw, body) = extract_frontmatter(content);

    let (frontmatter_fields, mut all_tags) = if let Some(ref raw) = frontmatter_raw {
        parse_frontmatter(raw)
    } else {
        (Default::default(), Vec::new())
    };

    let (links, inline_tags) = extract_links_and_tags(&body);
    all_tags.extend(inline_tags);
    all_tags.sort();
    all_tags.dedup();

    let blocks = slice_markdown_blocks(&body);

    ParsedDocument {
        frontmatter_raw,
        frontmatter_fields,
        tags: all_tags,
        blocks,
        links,
    }
}

pub fn slice_markdown_blocks(body: &str) -> Vec<ParsedBlock> {
    let lines: Vec<&str> = body.lines().collect();
    let mut blocks = Vec::new();

    let mut i = 0;
    let mut current_char_offset = 0;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        if trimmed.is_empty() {
            current_char_offset += line.len() + 1; // +1 for newline
            i += 1;
            continue;
        }

        let start_line = (i + 1) as i32;
        let start_char = current_char_offset as i32;

        if trimmed.starts_with("```") {
            // Fenced code block
            let mut code_lines = vec![line];
            let mut end_line = start_line;
            i += 1;
            while i < lines.len() {
                let code_line = lines[i];
                code_lines.push(code_line);
                end_line = (i + 1) as i32;
                if code_line.trim().starts_with("```") {
                    i += 1;
                    break;
                }
                i += 1;
            }

            let full_text = code_lines.join("\n");
            let end_char = start_char + full_text.len() as i32;
            current_char_offset += full_text.len() + 1;

            let block_id = extract_block_id(&full_text).unwrap_or_else(|| {
                generate_deterministic_block_id(&full_text, start_line as usize)
            });
            let clean = strip_block_id(&full_text);

            blocks.push(ParsedBlock {
                block_id,
                block_type: "code".to_string(),
                heading_level: None,
                start_line,
                end_line,
                start_char,
                end_char,
                content: clean.clone(),
                content_hash: calculate_blake3(clean.as_bytes()),
                text_preview: create_preview(&clean),
            });
            continue;
        }

        if trimmed.starts_with("$$") {
            // Math block
            let mut math_lines = vec![line];
            let mut end_line = start_line;
            i += 1;
            while i < lines.len() {
                let math_line = lines[i];
                math_lines.push(math_line);
                end_line = (i + 1) as i32;
                if math_line.trim().ends_with("$$") {
                    i += 1;
                    break;
                }
                i += 1;
            }

            let full_text = math_lines.join("\n");
            let end_char = start_char + full_text.len() as i32;
            current_char_offset += full_text.len() + 1;

            let block_id = extract_block_id(&full_text).unwrap_or_else(|| {
                generate_deterministic_block_id(&full_text, start_line as usize)
            });
            let clean = strip_block_id(&full_text);

            blocks.push(ParsedBlock {
                block_id,
                block_type: "math".to_string(),
                heading_level: None,
                start_line,
                end_line,
                start_char,
                end_char,
                content: clean.clone(),
                content_hash: calculate_blake3(clean.as_bytes()),
                text_preview: create_preview(&clean),
            });
            continue;
        }

        if trimmed.starts_with('#') {
            // Heading block
            let level = trimmed.chars().take_while(|c| *c == '#').count() as i32;
            let end_line = start_line;
            let end_char = start_char + line.len() as i32;
            current_char_offset += line.len() + 1;
            i += 1;

            let block_id = extract_block_id(line)
                .unwrap_or_else(|| generate_deterministic_block_id(line, start_line as usize));
            let clean = strip_block_id(line);

            blocks.push(ParsedBlock {
                block_id,
                block_type: "heading".to_string(),
                heading_level: Some(level),
                start_line,
                end_line,
                start_char,
                end_char,
                content: clean.clone(),
                content_hash: calculate_blake3(clean.as_bytes()),
                text_preview: create_preview(&clean),
            });
            continue;
        }

        if trimmed.starts_with('>') {
            // Blockquote
            let mut quote_lines = vec![line];
            let mut end_line = start_line;
            i += 1;
            while i < lines.len()
                && (lines[i].trim().starts_with('>') || !lines[i].trim().is_empty())
            {
                quote_lines.push(lines[i]);
                end_line = (i + 1) as i32;
                i += 1;
            }

            let full_text = quote_lines.join("\n");
            let end_char = start_char + full_text.len() as i32;
            current_char_offset += full_text.len() + 1;

            let block_id = extract_block_id(&full_text).unwrap_or_else(|| {
                generate_deterministic_block_id(&full_text, start_line as usize)
            });
            let clean = strip_block_id(&full_text);

            blocks.push(ParsedBlock {
                block_id,
                block_type: "blockquote".to_string(),
                heading_level: None,
                start_line,
                end_line,
                start_char,
                end_char,
                content: clean.clone(),
                content_hash: calculate_blake3(clean.as_bytes()),
                text_preview: create_preview(&clean),
            });
            continue;
        }

        // Standard paragraph or list
        let is_list = trimmed.starts_with('-')
            || trimmed.starts_with('*')
            || trimmed.starts_with('+')
            || (trimmed
                .chars()
                .next()
                .map(|c| c.is_ascii_digit())
                .unwrap_or(false)
                && trimmed.contains('.'));

        let block_type = if is_list { "list" } else { "paragraph" };

        let mut paragraph_lines = vec![line];
        let mut end_line = start_line;
        i += 1;

        while i < lines.len() {
            let next_line = lines[i];
            let next_trimmed = next_line.trim();
            if next_trimmed.is_empty()
                || next_trimmed.starts_with('#')
                || next_trimmed.starts_with("```")
                || next_trimmed.starts_with("$$")
                || next_trimmed.starts_with('>')
            {
                break;
            }
            paragraph_lines.push(next_line);
            end_line = (i + 1) as i32;
            i += 1;
        }

        let full_text = paragraph_lines.join("\n");
        let end_char = start_char + full_text.len() as i32;
        current_char_offset += full_text.len() + 1;

        let block_id = extract_block_id(&full_text)
            .unwrap_or_else(|| generate_deterministic_block_id(&full_text, start_line as usize));
        let clean = strip_block_id(&full_text);

        blocks.push(ParsedBlock {
            block_id,
            block_type: block_type.to_string(),
            heading_level: None,
            start_line,
            end_line,
            start_char,
            end_char,
            content: clean.clone(),
            content_hash: calculate_blake3(clean.as_bytes()),
            text_preview: create_preview(&clean),
        });
    }

    blocks
}

fn create_preview(text: &str) -> String {
    let single_line = text.replace('\n', " ").trim().to_string();
    if single_line.len() <= 120 {
        single_line
    } else {
        format!("{}...", &single_line[..117])
    }
}
