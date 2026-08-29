use crate::models::daily::{DailyNoteEntry, DailyNoteResult};
use crate::services::fs_service::atomic_write_file;
use chrono::{Duration, Local, NaiveDate};
use std::fs;
use std::path::Path;
use uuid::Uuid;

pub struct DailyService;

impl DailyService {
    pub fn get_or_create_daily_note(
        root: &Path,
        date_opt: Option<String>,
    ) -> Result<DailyNoteResult, String> {
        let date_str = match date_opt {
            Some(d) if !d.trim().is_empty() => d.trim().to_string(),
            _ => Local::now().format("%Y-%m-%d").to_string(),
        };

        let daily_dir = root.join("daily");
        if !daily_dir.exists() {
            fs::create_dir_all(&daily_dir)
                .map_err(|e| format!("Failed to create daily folder: {e}"))?;
        }

        let rel_path = format!("daily/{}.md", date_str);
        let full_path = root.join(&rel_path);

        if full_path.exists() && full_path.is_file() {
            let content = fs::read_to_string(&full_path).map_err(|e| {
                format!("Failed to read daily note '{}': {}", full_path.display(), e)
            })?;
            return Ok(DailyNoteResult {
                relative_path: rel_path,
                date: date_str,
                is_new: false,
                content,
            });
        }

        // Determine template content
        let template_path = root.join(".stackmynd").join("templates").join("daily.md");
        let raw_template = if template_path.exists() && template_path.is_file() {
            fs::read_to_string(&template_path).unwrap_or_else(|_| default_daily_template())
        } else {
            default_daily_template()
        };

        let content = interpolate_variables(&raw_template, &date_str, &date_str);

        // Atomic write with watcher suppression
        atomic_write_file(root, &rel_path, &content)?;

        Ok(DailyNoteResult {
            relative_path: rel_path,
            date: date_str,
            is_new: true,
            content,
        })
    }

    pub fn list_daily_notes(root: &Path) -> Result<Vec<DailyNoteEntry>, String> {
        let daily_dir = root.join("daily");
        if !daily_dir.exists() || !daily_dir.is_dir() {
            return Ok(Vec::new());
        }

        let mut entries = Vec::new();
        let read_dir =
            fs::read_dir(&daily_dir).map_err(|e| format!("Failed to read daily directory: {e}"))?;

        for entry in read_dir.flatten() {
            let path = entry.path();
            if path.is_file() {
                let file_name = path.file_name().unwrap_or_default().to_string_lossy();
                if let Some(stem) = file_name.strip_suffix(".md") {
                    if is_valid_date_format(stem) {
                        let content = fs::read_to_string(&path).unwrap_or_default();
                        let word_count = content.split_whitespace().count();
                        entries.push(DailyNoteEntry {
                            date: stem.to_string(),
                            relative_path: format!("daily/{}", file_name),
                            word_count,
                        });
                    }
                }
            }
        }

        entries.sort_by(|a, b| b.date.cmp(&a.date));
        Ok(entries)
    }
}

pub fn interpolate_variables(template: &str, date_str: &str, title: &str) -> String {
    let now = Local::now();
    let time_str = now.format("%H:%M").to_string();
    let datetime_str = format!("{} {}", date_str, time_str);

    let (weekday_str, yesterday_str, tomorrow_str) =
        if let Ok(parsed_date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            let weekday = parsed_date.format("%A").to_string();
            let yesterday = (parsed_date - Duration::days(1))
                .format("%Y-%m-%d")
                .to_string();
            let tomorrow = (parsed_date + Duration::days(1))
                .format("%Y-%m-%d")
                .to_string();
            (weekday, yesterday, tomorrow)
        } else {
            (
                now.format("%A").to_string(),
                date_str.to_string(),
                date_str.to_string(),
            )
        };

    let uuid_str = Uuid::new_v4().to_string();

    template
        .replace("{{date}}", date_str)
        .replace("{{time}}", &time_str)
        .replace("{{datetime}}", &datetime_str)
        .replace("{{title}}", title)
        .replace("{{weekday}}", &weekday_str)
        .replace("{{yesterday}}", &yesterday_str)
        .replace("{{tomorrow}}", &tomorrow_str)
        .replace("{{uuid}}", &uuid_str)
}

fn default_daily_template() -> String {
    r#"# {{date}} ({{weekday}})

## Focus & Priorities
- [ ] 

## Notes & Journal


## Retrospective & Review
"#
    .to_string()
}

fn is_valid_date_format(s: &str) -> bool {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}
