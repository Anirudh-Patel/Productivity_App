// GitHub integration: open issues -> tasks via the locally-installed, authenticated `gh` CLI.
// No credentials are stored; all GitHub access shells out to `gh` (std::process::Command).

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::process::Command;
use tauri::State;

use crate::database::DbConnection;

// ---------- Types ----------

#[derive(Debug, Clone, Serialize)]
pub struct GithubCliStatus {
    pub installed: bool,
    pub authenticated: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GithubRepo {
    pub id: i64,
    pub owner: String,
    pub name: String,
    pub enabled: bool,
    pub last_synced_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GithubSettings {
    pub sync_enabled: bool,
    pub close_on_complete: bool,
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct GithubSyncSummary {
    pub repos_synced: i64,
    pub issues_imported: i64,
    pub tasks_updated: i64,
    pub tasks_completed: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GithubTaskLink {
    pub task_id: i64,
    pub repo: String,
    pub issue_number: i64,
    pub url: String,
}

#[derive(Debug, Deserialize)]
struct GhIssue {
    number: i64,
    title: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    labels: Vec<GhLabel>,
    #[serde(default)]
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GhLabel {
    name: String,
}

#[derive(Debug, Deserialize)]
struct GhRepoView {
    name: String,
    owner: GhRepoOwner,
}

#[derive(Debug, Deserialize)]
struct GhRepoOwner {
    login: String,
}

// ---------- gh CLI helpers ----------

/// Candidate locations for the gh binary. GUI apps on macOS often launch with a
/// minimal PATH, so fall back to the common Homebrew/system install locations.
const GH_CANDIDATES: &[&str] = &["gh", "/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"];

fn find_gh() -> Result<String, String> {
    for candidate in GH_CANDIDATES {
        if let Ok(output) = Command::new(candidate).arg("--version").output() {
            if output.status.success() {
                return Ok(candidate.to_string());
            }
        }
    }
    Err("GitHub CLI (gh) not found. Install it with `brew install gh` and run `gh auth login`.".to_string())
}

fn run_gh(args: &[&str]) -> Result<String, String> {
    let gh = find_gh()?;
    let output = Command::new(&gh)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run gh: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "gh {} failed: {}",
            args.first().unwrap_or(&""),
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Derive task difficulty (1-10) from issue labels.
/// Supports explicit "difficulty:N" labels plus common effort labels; defaults to 3.
fn difficulty_from_labels(labels: &[GhLabel]) -> i64 {
    for label in labels {
        let name = label.name.to_lowercase();
        if let Some(value) = name
            .strip_prefix("difficulty:")
            .or_else(|| name.strip_prefix("difficulty "))
        {
            if let Ok(n) = value.trim().parse::<i64>() {
                return n.clamp(1, 10);
            }
        }
    }
    for label in labels {
        let name = label.name.to_lowercase();
        if name.contains("good first issue") || name.contains("easy") || name.contains("trivial") {
            return 2;
        }
        if name.contains("hard") || name.contains("epic") || name.contains("complex") {
            return 5;
        }
    }
    3
}

/// Keep imported descriptions to a sane length for task cards.
fn truncate_body(body: &str) -> String {
    const MAX: usize = 500;
    if body.chars().count() <= MAX {
        return body.trim().to_string();
    }
    let truncated: String = body.chars().take(MAX).collect();
    format!("{}…", truncated.trim_end())
}

fn parse_owner_repo(input: &str) -> Result<(String, String), String> {
    let cleaned = input
        .trim()
        .trim_start_matches("https://github.com/")
        .trim_end_matches('/')
        .to_string();
    let parts: Vec<&str> = cleaned.split('/').filter(|p| !p.is_empty()).collect();
    if parts.len() != 2 {
        return Err("Repository must be in the form owner/repo".to_string());
    }
    Ok((parts[0].to_string(), parts[1].to_string()))
}

fn row_to_repo(row: &rusqlite::Row) -> rusqlite::Result<GithubRepo> {
    Ok(GithubRepo {
        id: row.get(0)?,
        owner: row.get(1)?,
        name: row.get(2)?,
        enabled: row.get::<_, i64>(3)? != 0,
        last_synced_at: row.get(4)?,
    })
}

// ---------- Commands ----------

#[tauri::command]
pub async fn github_check_cli() -> Result<GithubCliStatus, String> {
    let gh = match find_gh() {
        Ok(path) => path,
        Err(message) => {
            return Ok(GithubCliStatus {
                installed: false,
                authenticated: false,
                message,
            })
        }
    };

    let output = Command::new(&gh)
        .args(["auth", "status"])
        .output()
        .map_err(|e| format!("Failed to run gh auth status: {}", e))?;

    if output.status.success() {
        Ok(GithubCliStatus {
            installed: true,
            authenticated: true,
            message: "GitHub CLI is installed and authenticated".to_string(),
        })
    } else {
        Ok(GithubCliStatus {
            installed: true,
            authenticated: false,
            message: "GitHub CLI is installed but not authenticated. Run `gh auth login`.".to_string(),
        })
    }
}

#[tauri::command]
pub async fn github_list_repos(db: State<'_, DbConnection>) -> Result<Vec<GithubRepo>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT id, owner, name, enabled, last_synced_at FROM github_repos ORDER BY owner, name")
        .map_err(|e| format!("Failed to prepare repos query: {}", e))?;

    let repos: Result<Vec<GithubRepo>, _> = stmt
        .query_map([], |row| row_to_repo(row))
        .map_err(|e| format!("Failed to query repos: {}", e))?
        .collect();

    repos.map_err(|e| format!("Failed to collect repos: {}", e))
}

#[tauri::command]
pub async fn github_add_repo(db: State<'_, DbConnection>, owner_repo: String) -> Result<GithubRepo, String> {
    let (owner, name) = parse_owner_repo(&owner_repo)?;
    let full = format!("{}/{}", owner, name);

    // Validate the repo exists / is accessible, and get canonical casing.
    let output = run_gh(&["repo", "view", &full, "--json", "name,owner"])?;
    let view: GhRepoView = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse gh repo view output: {}", e))?;

    let conn = db.lock().await;
    conn.execute(
        "INSERT INTO github_repos (user_id, owner, name, enabled) VALUES (1, ?1, ?2, 1)
         ON CONFLICT(owner, name) DO UPDATE SET enabled = 1",
        rusqlite::params![view.owner.login, view.name],
    )
    .map_err(|e| format!("Failed to add repo: {}", e))?;

    conn.query_row(
        "SELECT id, owner, name, enabled, last_synced_at FROM github_repos WHERE owner = ?1 AND name = ?2",
        rusqlite::params![view.owner.login, view.name],
        |row| row_to_repo(row),
    )
    .map_err(|e| format!("Failed to load added repo: {}", e))
}

#[tauri::command]
pub async fn github_remove_repo(db: State<'_, DbConnection>, repo_id: i64) -> Result<(), String> {
    let conn = db.lock().await;
    conn.execute("DELETE FROM github_repos WHERE id = ?1", [repo_id])
        .map_err(|e| format!("Failed to remove repo: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn github_toggle_repo(db: State<'_, DbConnection>, repo_id: i64) -> Result<bool, String> {
    let conn = db.lock().await;
    conn.execute(
        "UPDATE github_repos SET enabled = CASE enabled WHEN 0 THEN 1 ELSE 0 END WHERE id = ?1",
        [repo_id],
    )
    .map_err(|e| format!("Failed to toggle repo: {}", e))?;

    conn.query_row(
        "SELECT enabled FROM github_repos WHERE id = ?1",
        [repo_id],
        |row| row.get::<_, i64>(0).map(|v| v != 0),
    )
    .map_err(|e| format!("Failed to read repo state: {}", e))
}

#[tauri::command]
pub async fn github_get_settings(db: State<'_, DbConnection>) -> Result<GithubSettings, String> {
    let conn = db.lock().await;
    conn.query_row(
        "SELECT sync_enabled, close_on_complete, last_sync_at FROM github_settings WHERE id = 1",
        [],
        |row| {
            Ok(GithubSettings {
                sync_enabled: row.get::<_, i64>(0)? != 0,
                close_on_complete: row.get::<_, i64>(1)? != 0,
                last_sync_at: row.get(2)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read GitHub settings: {}", e))
}

#[tauri::command]
pub async fn github_update_settings(
    db: State<'_, DbConnection>,
    sync_enabled: bool,
    close_on_complete: bool,
) -> Result<GithubSettings, String> {
    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE github_settings SET sync_enabled = ?1, close_on_complete = ?2 WHERE id = 1",
            rusqlite::params![sync_enabled as i64, close_on_complete as i64],
        )
        .map_err(|e| format!("Failed to update GitHub settings: {}", e))?;
    }
    github_get_settings(db).await
}

/// task_id -> GitHub issue link, for tagging task cards in the UI.
#[tauri::command]
pub async fn github_get_task_links(db: State<'_, DbConnection>) -> Result<Vec<GithubTaskLink>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, github_repo, github_issue_number FROM tasks
             WHERE github_repo IS NOT NULL AND github_issue_number IS NOT NULL",
        )
        .map_err(|e| format!("Failed to prepare task links query: {}", e))?;

    let links: Result<Vec<GithubTaskLink>, _> = stmt
        .query_map([], |row| {
            let repo: String = row.get(1)?;
            let issue_number: i64 = row.get(2)?;
            Ok(GithubTaskLink {
                task_id: row.get(0)?,
                url: format!("https://github.com/{}/issues/{}", repo, issue_number),
                repo,
                issue_number,
            })
        })
        .map_err(|e| format!("Failed to query task links: {}", e))?
        .collect();

    links.map_err(|e| format!("Failed to collect task links: {}", e))
}

/// Close a GitHub issue (used when a linked task is completed in-app).
#[tauri::command]
pub async fn github_close_issue(repo: String, issue_number: i64) -> Result<(), String> {
    run_gh(&[
        "issue",
        "close",
        &issue_number.to_string(),
        "--repo",
        &repo,
        "--comment",
        "Completed via Life Quest ⚔️",
    ])?;
    Ok(())
}

/// Pull-based sync: import open issues from every enabled watched repo as tasks,
/// refresh titles of already-imported tasks, and auto-complete tasks whose issue
/// was closed on GitHub (granting XP via the normal complete_task path).
#[tauri::command]
pub async fn github_sync(db: State<'_, DbConnection>) -> Result<GithubSyncSummary, String> {
    let mut summary = GithubSyncSummary::default();

    // Snapshot enabled repos, then release the lock while shelling out to gh.
    let repos: Vec<(i64, String)> = {
        let conn = db.lock().await;
        let mut stmt = conn
            .prepare("SELECT id, owner || '/' || name FROM github_repos WHERE enabled = 1 ORDER BY id")
            .map_err(|e| format!("Failed to prepare repos query: {}", e))?;
        let rows: Result<Vec<(i64, String)>, _> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| format!("Failed to query repos: {}", e))?
            .collect();
        rows.map_err(|e| format!("Failed to collect repos: {}", e))?
    };

    let mut tasks_to_complete: Vec<i64> = Vec::new();

    for (repo_id, repo_full) in repos {
        let issues: Vec<GhIssue> = match run_gh(&[
            "issue",
            "list",
            "--repo",
            &repo_full,
            "--state",
            "open",
            "--json",
            "number,title,body,labels,url",
            "--limit",
            "200",
        ])
        .and_then(|out| {
            serde_json::from_str(&out).map_err(|e| format!("Failed to parse issues for {}: {}", repo_full, e))
        }) {
            Ok(issues) => issues,
            Err(e) => {
                summary.errors.push(e);
                continue;
            }
        };

        let open_numbers: HashSet<i64> = issues.iter().map(|i| i.number).collect();

        {
            let conn = db.lock().await;

            for issue in &issues {
                let existing: Option<(i64, String, String)> = conn
                    .query_row(
                        "SELECT id, status, title FROM tasks WHERE github_repo = ?1 AND github_issue_number = ?2",
                        rusqlite::params![repo_full, issue.number],
                        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                    )
                    .optional()
                    .map_err(|e| format!("Failed to look up task for {}#{}: {}", repo_full, issue.number, e))?;

                match existing {
                    Some((task_id, status, title)) => {
                        // Keep the title of still-open imported tasks in sync with GitHub.
                        if status == "active" && title != issue.title {
                            conn.execute(
                                "UPDATE tasks SET title = ?1 WHERE id = ?2",
                                rusqlite::params![issue.title, task_id],
                            )
                            .map_err(|e| format!("Failed to update task {}: {}", task_id, e))?;
                            summary.tasks_updated += 1;
                        }
                        // Completed/archived tasks are left alone (reopened issues are out of scope).
                    }
                    None => {
                        let difficulty = difficulty_from_labels(&issue.labels);
                        // Same reward formula as create_task in lib.rs.
                        let base_xp = 10 + (difficulty - 1) * 5;
                        let gold_reward = 1 + (difficulty - 1);
                        let description = issue
                            .body
                            .as_deref()
                            .filter(|b| !b.trim().is_empty())
                            .map(truncate_body)
                            .unwrap_or_else(|| issue.url.clone().unwrap_or_default());

                        conn.execute(
                            "INSERT INTO tasks (user_id, title, description, category, difficulty,
                             base_experience_reward, gold_reward, status, priority, task_type,
                             github_issue_id, github_repo, github_issue_number)
                             VALUES (1, ?1, ?2, 'work', ?3, ?4, ?5, 'active', 3, 'standard', ?6, ?7, ?8)",
                            rusqlite::params![
                                issue.title,
                                description,
                                difficulty as i32,
                                base_xp as i32,
                                gold_reward as i32,
                                issue.number,
                                repo_full,
                                issue.number,
                            ],
                        )
                        .map_err(|e| format!("Failed to import issue {}#{}: {}", repo_full, issue.number, e))?;
                        summary.issues_imported += 1;
                    }
                }
            }

            // Any still-active imported task whose issue is no longer open was closed
            // on GitHub -> complete it in-app (after releasing the lock).
            let mut stmt = conn
                .prepare(
                    "SELECT id, github_issue_number FROM tasks
                     WHERE github_repo = ?1 AND github_issue_number IS NOT NULL AND status = 'active'",
                )
                .map_err(|e| format!("Failed to prepare stale-tasks query: {}", e))?;
            let stale: Vec<(i64, i64)> = stmt
                .query_map([&repo_full], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(|e| format!("Failed to query stale tasks: {}", e))?
                .filter_map(Result::ok)
                .collect();
            drop(stmt);

            for (task_id, issue_number) in stale {
                if !open_numbers.contains(&issue_number) {
                    tasks_to_complete.push(task_id);
                }
            }

            conn.execute(
                "UPDATE github_repos SET last_synced_at = CURRENT_TIMESTAMP WHERE id = ?1",
                [repo_id],
            )
            .map_err(|e| format!("Failed to stamp repo sync time: {}", e))?;
        }

        summary.repos_synced += 1;
    }

    // Reuse the standard completion path (XP/gold/streak logic) for closed issues.
    for task_id in tasks_to_complete {
        match crate::complete_task(db.clone(), task_id).await {
            Ok(_) => summary.tasks_completed += 1,
            Err(e) => summary.errors.push(format!("Failed to complete task {}: {}", task_id, e)),
        }
    }

    {
        let conn = db.lock().await;
        conn.execute("UPDATE github_settings SET last_sync_at = CURRENT_TIMESTAMP WHERE id = 1", [])
            .map_err(|e| format!("Failed to stamp sync time: {}", e))?;
    }

    Ok(summary)
}
