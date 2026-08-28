use crate::models::git::{
    GitBranch, GitBranchesResult, GitCommit, GitCommitResult, GitFileStatus, GitStatusResult,
};
use std::path::Path;
use std::process::Command;

fn run_git_cmd(workspace_root: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(workspace_root)
        .output()
        .map_err(|e| format!("Failed to execute git command: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.trim().to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

pub fn is_git_repo(workspace_root: &Path) -> bool {
    workspace_root.join(".git").exists()
        || run_git_cmd(workspace_root, &["rev-parse", "--is-inside-work-tree"]).is_ok()
}

pub fn get_status(workspace_root: &Path) -> Result<GitStatusResult, String> {
    if !is_git_repo(workspace_root) {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: String::new(),
            files: Vec::new(),
            clean: true,
        });
    }

    let branch = run_git_cmd(workspace_root, &["branch", "--show-current"])
        .unwrap_or_else(|_| "HEAD".to_string());
    let branch = if branch.is_empty() {
        "HEAD (detached)".to_string()
    } else {
        branch
    };

    let status_out = run_git_cmd(workspace_root, &["status", "--porcelain=v1"])?;
    let mut files = Vec::new();

    for line in status_out.lines() {
        if line.len() < 4 {
            continue;
        }
        let code = &line[..2];
        let path = line[3..].trim().to_string();

        let status = if code == "??" {
            "untracked"
        } else if code.contains('D') {
            "deleted"
        } else if code.starts_with('A') {
            "staged"
        } else {
            "modified"
        };

        files.push(GitFileStatus {
            path,
            status: status.to_string(),
        });
    }

    let clean = files.is_empty();

    Ok(GitStatusResult {
        is_repo: true,
        branch,
        files,
        clean,
    })
}

pub fn get_diff(workspace_root: &Path, file_path: Option<&str>) -> Result<String, String> {
    if !is_git_repo(workspace_root) {
        return Err("Workspace is not a Git repository".to_string());
    }

    if let Some(fp) = file_path {
        // If untracked, display file content as added
        let full_path = workspace_root.join(fp);
        let status = get_status(workspace_root)?;
        let is_untracked = status
            .files
            .iter()
            .any(|f| f.path == fp && f.status == "untracked");

        if is_untracked && full_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&full_path) {
                let mut diff = format!(
                    "--- /dev/null\n+++ b/{fp}\n@@ -0,0 +1,{} @@\n",
                    content.lines().count()
                );
                for line in content.lines() {
                    diff.push('+');
                    diff.push_str(line);
                    diff.push('\n');
                }
                return Ok(diff);
            }
        }

        // Try git diff HEAD -- <file_path>, fallback to git diff -- <file_path>
        match run_git_cmd(workspace_root, &["diff", "HEAD", "--", fp]) {
            Ok(d) if !d.is_empty() => Ok(d),
            _ => run_git_cmd(workspace_root, &["diff", "--", fp]),
        }
    } else {
        match run_git_cmd(workspace_root, &["diff", "HEAD"]) {
            Ok(d) if !d.is_empty() => Ok(d),
            _ => run_git_cmd(workspace_root, &["diff"]),
        }
    }
}

pub fn commit(
    workspace_root: &Path,
    message: &str,
    stage_all: bool,
) -> Result<GitCommitResult, String> {
    if !is_git_repo(workspace_root) {
        return Err("Workspace is not a Git repository".to_string());
    }

    let msg = message.trim();
    if msg.is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    if stage_all {
        run_git_cmd(workspace_root, &["add", "-A"])?;
    }

    run_git_cmd(workspace_root, &["commit", "--no-gpg-sign", "-m", msg])?;

    let hash = run_git_cmd(workspace_root, &["rev-parse", "HEAD"])?;
    let short_hash = if hash.len() >= 7 {
        hash[..7].to_string()
    } else {
        hash.clone()
    };

    Ok(GitCommitResult {
        commit_hash: short_hash,
        message: msg.to_string(),
    })
}

pub fn get_log(workspace_root: &Path, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    if !is_git_repo(workspace_root) {
        return Ok(Vec::new());
    }

    let limit_str = limit.unwrap_or(30).to_string();
    let format_arg = "--format=%H%x1f%h%x1f%an%x1f%ae%x1f%at%x1f%s";

    let out = match run_git_cmd(workspace_root, &["log", "-n", &limit_str, format_arg]) {
        Ok(o) => o,
        Err(_) => return Ok(Vec::new()), // Repo might have 0 commits yet
    };

    let mut commits = Vec::new();
    for line in out.lines() {
        let parts: Vec<&str> = line.split('\x1f').collect();
        if parts.len() >= 6 {
            let timestamp = parts[4].parse::<i64>().unwrap_or(0);
            commits.push(GitCommit {
                hash: parts[0].to_string(),
                short_hash: parts[1].to_string(),
                author: parts[2].to_string(),
                email: parts[3].to_string(),
                timestamp,
                message: parts[5].to_string(),
            });
        }
    }

    Ok(commits)
}

pub fn list_branches(workspace_root: &Path) -> Result<GitBranchesResult, String> {
    if !is_git_repo(workspace_root) {
        return Ok(GitBranchesResult {
            branches: Vec::new(),
            current: String::new(),
        });
    }

    let out = run_git_cmd(workspace_root, &["branch", "--list"])?;
    let mut branches = Vec::new();
    let mut current = String::new();

    for line in out.lines() {
        let is_cur = line.starts_with('*');
        let name = line.trim_start_matches('*').trim().to_string();
        if is_cur {
            current = name.clone();
        }
        branches.push(GitBranch {
            name,
            is_current: is_cur,
        });
    }

    Ok(GitBranchesResult { branches, current })
}

pub fn checkout_branch(workspace_root: &Path, branch_name: &str) -> Result<(), String> {
    if !is_git_repo(workspace_root) {
        return Err("Workspace is not a Git repository".to_string());
    }
    run_git_cmd(workspace_root, &["checkout", branch_name])?;
    Ok(())
}

pub fn create_branch(workspace_root: &Path, branch_name: &str) -> Result<(), String> {
    if !is_git_repo(workspace_root) {
        return Err("Workspace is not a Git repository".to_string());
    }
    run_git_cmd(workspace_root, &["checkout", "-b", branch_name])?;
    Ok(())
}
