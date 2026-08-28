use std::collections::HashMap;

/// Extracts leading YAML frontmatter delimited by `---` lines.
pub fn extract_frontmatter(content: &str) -> (Option<String>, String) {
    if !content.starts_with("---") {
        return (None, content.to_string());
    }

    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() || lines[0].trim() != "---" {
        return (None, content.to_string());
    }

    let mut end_idx = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim() == "---" {
            end_idx = Some(i);
            break;
        }
    }

    if let Some(end) = end_idx {
        let yaml_lines = &lines[1..end];
        let raw_yaml = yaml_lines.join("\n");
        let body_lines = &lines[end + 1..];
        let body = body_lines.join("\n");
        (Some(raw_yaml), body)
    } else {
        (None, content.to_string())
    }
}

/// Parses frontmatter YAML into a key-value dictionary and extracted tag list.
pub fn parse_frontmatter(raw_yaml: &str) -> (HashMap<String, serde_json::Value>, Vec<String>) {
    let mut fields = HashMap::new();
    let mut tags = Vec::new();

    if let Ok(serde_yaml::Value::Mapping(map)) = serde_yaml::from_str::<serde_yaml::Value>(raw_yaml)
    {
        for (k, v) in map {
            if let Some(key_str) = k.as_str() {
                let json_val = serde_json::to_value(&v).unwrap_or(serde_json::Value::Null);

                if key_str == "tags" || key_str == "tag" {
                    match &v {
                        serde_yaml::Value::Sequence(seq) => {
                            for item in seq {
                                if let Some(t) = item.as_str() {
                                    tags.push(t.trim_start_matches('#').to_string());
                                }
                            }
                        }
                        serde_yaml::Value::String(s) => {
                            for part in s.split(',') {
                                let t = part.trim().trim_start_matches('#');
                                if !t.is_empty() {
                                    tags.push(t.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }

                fields.insert(key_str.to_string(), json_val);
            }
        }
    }

    (fields, tags)
}

/// Updates or inserts a top-level frontmatter key while preserving document structure.
pub fn update_frontmatter_value(content: &str, key: &str, value: &str) -> String {
    let (raw_opt, body) = extract_frontmatter(content);

    let mut yaml_lines = Vec::new();
    let mut key_found = false;

    if let Some(raw) = raw_opt {
        for line in raw.lines() {
            if let Some(colon_idx) = line.find(':') {
                let k = line[..colon_idx].trim();
                if k == key {
                    yaml_lines.push(format!("{key}: {value}"));
                    key_found = true;
                    continue;
                }
            }
            yaml_lines.push(line.to_string());
        }
    }

    if !key_found {
        yaml_lines.push(format!("{key}: {value}"));
    }

    let new_yaml = yaml_lines.join("\n");
    format!("---\n{new_yaml}\n---\n{body}")
}
