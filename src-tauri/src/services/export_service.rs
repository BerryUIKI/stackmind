use std::fs;
use std::path::Path;

/// Safely writes exported content (HTML, Markdown, etc.) to a destination path chosen by the user.
pub fn export_file_to_disk(destination_path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create destination directory: {}", e))?;
        }
    }

    fs::write(destination_path, content.as_bytes())
        .map_err(|e| format!("Failed to write export file: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_export_file_to_disk() {
        let dir = tempdir().unwrap();
        let target = dir.path().join("sub/exported.html");
        let sample_html = "<!DOCTYPE html><html><body>Test</body></html>";

        export_file_to_disk(&target, sample_html).unwrap();
        assert!(target.exists());

        let read = fs::read_to_string(&target).unwrap();
        assert_eq!(read, sample_html);
    }
}
