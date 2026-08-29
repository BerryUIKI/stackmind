use crate::models::template::TemplateMetadata;
use crate::services::daily::interpolate_variables;
use crate::services::markdown::frontmatter::extract_frontmatter;
use chrono::Local;
use std::fs;
use std::path::Path;

pub struct TemplateService;

impl TemplateService {
    pub fn list_templates(root: &Path) -> Result<Vec<TemplateMetadata>, String> {
        let templates_dir = root.join(".stackmynd").join("templates");
        if !templates_dir.exists() {
            fs::create_dir_all(&templates_dir)
                .map_err(|e| format!("Failed to create templates folder: {e}"))?;
        }

        // Check if empty, provision starters if so
        ensure_starter_templates(&templates_dir)?;

        let mut templates = Vec::new();
        let read_dir = fs::read_dir(&templates_dir)
            .map_err(|e| format!("Failed to read templates directory: {e}"))?;

        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();
                if let Some(stem) = file_name.strip_suffix(".md") {
                    let content = fs::read_to_string(&path).unwrap_or_default();
                    let description = extract_description(&content);

                    templates.push(TemplateMetadata {
                        name: stem.to_string(),
                        relative_path: format!(".stackmynd/templates/{}", file_name),
                        description,
                        content,
                    });
                }
            }
        }

        templates.sort_by_key(|a| a.name.to_lowercase());
        Ok(templates)
    }

    pub fn apply_template(
        root: &Path,
        template_name_or_path: &str,
        note_title: &str,
    ) -> Result<String, String> {
        let templates_dir = root.join(".stackmynd").join("templates");
        let candidate = if template_name_or_path.ends_with(".md") {
            templates_dir.join(template_name_or_path)
        } else {
            templates_dir.join(format!("{}.md", template_name_or_path))
        };

        let file_path = if candidate.exists() && candidate.is_file() {
            candidate
        } else {
            let direct = root.join(template_name_or_path);
            if direct.exists() && direct.is_file() {
                direct
            } else {
                return Err(format!("Template '{}' not found", template_name_or_path));
            }
        };

        let raw = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read template '{}': {e}", file_path.display()))?;

        let today = Local::now().format("%Y-%m-%d").to_string();
        let evaluated = interpolate_variables(&raw, &today, note_title);
        Ok(evaluated)
    }
}

fn extract_description(content: &str) -> Option<String> {
    let (fm, _) = extract_frontmatter(content);
    if let Some(raw_fm) = fm {
        for line in raw_fm.lines() {
            let trimmed = line.trim();
            if let Some(desc) = trimmed.strip_prefix("description:") {
                return Some(desc.trim().trim_matches('"').trim_matches('\'').to_string());
            }
        }
    }

    // Fallback to first non-heading, non-empty line
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("---") {
            return Some(trimmed.chars().take(80).collect());
        }
    }

    None
}

fn ensure_starter_templates(dir: &Path) -> Result<(), String> {
    let entries_count = fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .count();

    if entries_count > 0 {
        return Ok(());
    }

    // 1. daily.md
    let daily_tpl = r#"---
title: "{{date}}"
tags: [daily, journal]
description: "Daily planner, focus priorities, and evening retrospective"
---

# {{date}} ({{weekday}})

## 🎯 Focus & Priorities
- [ ] 

## 📝 Notes & Logs


## 💡 Insights & Retrospective

"#;
    let _ = fs::write(dir.join("daily.md"), daily_tpl);

    // 2. meeting.md
    let meeting_tpl = r#"---
title: "Meeting: {{title}}"
date: "{{date}}"
tags: [meeting]
description: "Structured agenda, attendee list, discussion notes, and action items"
---

# Meeting: {{title}}

- **Date:** {{datetime}}
- **Attendees:** 

## 📋 Agenda
1. 

## 🗣️ Discussion & Notes


## ✅ Action Items
- [ ] 
"#;
    let _ = fs::write(dir.join("meeting.md"), meeting_tpl);

    // 3. concept.md
    let concept_tpl = r#"---
title: "{{title}}"
created: "{{date}}"
tags: [concept, atomic]
description: "Atomic permanent knowledge card with definition, context, and links"
---

# {{title}}

## 📌 Definition & Core Idea


## 🔍 Elaboration & Mechanics


## 🔗 Related Concepts
- [[Related Note]]
"#;
    let _ = fs::write(dir.join("concept.md"), concept_tpl);

    // 4. literature.md
    let lit_tpl = r#"---
title: "Literature: {{title}}"
date: "{{date}}"
tags: [literature, reading]
description: "Book, paper, or article summary with key citations and quotes"
---

# Literature: {{title}}

- **Author:** 
- **Source / DOI:** 
- **Read Date:** {{date}}

## 📖 Key Takeaways
- 

## 💬 Notable Quotations
> 

## 🧠 Personal Reflections & Applications

"#;
    let _ = fs::write(dir.join("literature.md"), lit_tpl);

    Ok(())
}
