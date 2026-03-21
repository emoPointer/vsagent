use std::path::{Path, PathBuf};
use std::io::{BufRead, BufReader};
use std::fs::File;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use rusqlite::Connection;
use sha2::{Sha256, Digest};

use crate::db::{workspace, conversation, message};
use crate::domain::{Workspace, Conversation};
use crate::importer::parser;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn workspace_id(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hex::encode(hasher.finalize())
}

/// Get git repo root for a directory (cached via DB workspace table)
fn get_git_root(path: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["-C", path, "rev-parse", "--show-toplevel"])
        .output()
        .ok()?;
    if output.status.success() {
        String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

/// Import all JSONL files under a root directory
pub fn import_all(conn: &Connection, root: &Path) -> Result<()> {
    if !root.exists() {
        log::info!("Claude projects dir does not exist: {}", root.display());
        return Ok(());
    }

    for entry in walkdir(root) {
        if let Err(e) = import_file(conn, &entry) {
            log::error!("Failed to import {}: {e}", entry.display());
        }
    }
    Ok(())
}

/// Walk directory and collect .jsonl files
fn walkdir(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir(&path));
            } else if path.extension().map_or(false, |e| e == "jsonl") {
                files.push(path);
            }
        }
    }
    files
}

/// Import a single JSONL file incrementally
pub fn import_file(conn: &Connection, jsonl_path: &Path) -> Result<()> {
    let file = File::open(jsonl_path)?;
    let reader = BufReader::new(file);
    let path_str = jsonl_path.to_string_lossy().to_string();

    let mut session_id: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut first_ts: Option<i64> = None;
    let mut last_ts: Option<i64> = None;
    let mut first_user_text: Option<String> = None;
    // Claude Code generated title — takes priority over first_user_text
    let mut custom_title: Option<String> = None;

    // Collect all parsed lines first to determine seq offsets
    let mut parsed_lines = Vec::new();
    for line in reader.lines() {
        let line = line?;
        let line = line.trim();
        if line.is_empty() { continue; }

        if let Some(parsed) = parser::parse_line(line, 0) {
            // Update metadata
            if session_id.is_none() { session_id = parsed.session_id.clone(); }
            if cwd.is_none() { cwd = parsed.cwd.clone(); }
            if git_branch.is_none() { git_branch = parsed.git_branch.clone(); }
            if let Some(ts) = parsed.timestamp_ms {
                if first_ts.is_none() { first_ts = Some(ts); }
                last_ts = Some(ts);
            }
            // Keep the latest custom-title (Claude Code appends new ones as session evolves)
            if let Some(ref t) = parsed.custom_title {
                custom_title = Some(t.clone());
            }
            parsed_lines.push(parsed);
        }
    }

    let session_id = match session_id {
        Some(id) => id,
        None => {
            log::warn!("No sessionId found in {}", jsonl_path.display());
            return Ok(());
        }
    };

    // Ensure workspace
    let workspace_id_val = if let Some(ref cwd_str) = cwd {
        let ws_id = workspace_id(cwd_str);
        if workspace::find_by_path(conn, cwd_str)?.is_none() {
            let name = Path::new(cwd_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| cwd_str.clone());
            let git_root = get_git_root(cwd_str);
            workspace::upsert(conn, &Workspace {
                id: ws_id.clone(),
                name,
                root_path: cwd_str.clone(),
                git_repo_root: git_root,
                created_at: first_ts.unwrap_or_else(now_ms),
                updated_at: now_ms(),
            })?;
        }
        Some(ws_id)
    } else {
        None
    };

    // Ensure conversation
    let now = now_ms();
    conversation::upsert(conn, &Conversation {
        id: session_id.clone(),
        workspace_id: workspace_id_val,
        provider: "claude_code".into(),
        title: None, // set after we find first user message
        status: "idle".into(),
        branch_name: git_branch,
        pinned: false,
        archived: false,
        last_message_at: last_ts,
        jsonl_path: path_str,
        created_at: first_ts.unwrap_or(now),
        updated_at: now,
    })?;

    // Import messages with correct seq
    // seq = count of already-imported messages + index in this batch
    let existing_count = message::count_for_conversation(conn, &session_id)?;
    let mut msg_seq = existing_count;

    conn.execute("BEGIN IMMEDIATE", [])?;
    for parsed in parsed_lines {
        if let Some(mut msg) = parsed.message {
            if msg.conversation_id == session_id {
                // Extract first user message for title
                if first_user_text.is_none() && msg.role == "user" {
                    first_user_text = msg.content_text.as_ref().map(|t| {
                        t.chars().take(60).collect()
                    });
                }
                msg.seq = msg_seq;
                message::insert_ignore(conn, &msg)?;
                msg_seq += 1;
            }
        }
    }
    conn.execute("COMMIT", [])?;

    // custom-title takes priority; fallback to first user message snippet
    // Always overwrite with custom_title (Claude Code may update it); only set
    // first_user_text when title is still NULL (never overwrite manual renames).
    if let Some(title) = custom_title {
        conn.execute(
            "UPDATE conversations SET title=?1 WHERE id=?2",
            rusqlite::params![title, session_id],
        )?;
    } else if let Some(title) = first_user_text {
        conn.execute(
            "UPDATE conversations SET title=?1 WHERE id=?2 AND title IS NULL",
            rusqlite::params![title, session_id],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, migrations};
    use tempfile::tempdir;
    use std::io::Write;

    fn setup() -> Connection {
        let conn = open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    fn write_jsonl(dir: &Path, name: &str, lines: &[&str]) -> PathBuf {
        let path = dir.join(name);
        let mut f = File::create(&path).unwrap();
        for line in lines {
            writeln!(f, "{line}").unwrap();
        }
        path
    }

    const LINE_U: &str = r#"{"uuid":"u1","parentUuid":null,"type":"user","sessionId":"sess1","cwd":"/tmp/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:00Z","isSidechain":false,"message":{"role":"user","content":"Hello"}}"#;
    const LINE_A: &str = r#"{"uuid":"a1","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/tmp/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:01Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"text","text":"Hi there"}]}}"#;
    const LINE_TITLE: &str = r#"{"type":"custom-title","customTitle":"Fix clippy warnings in parser","sessionId":"sess1"}"#;

    #[test]
    fn import_file_creates_conversation_and_messages() {
        let conn = setup();
        let dir = tempdir().unwrap();
        let path = write_jsonl(dir.path(), "test.jsonl", &[LINE_U, LINE_A]);

        import_file(&conn, &path).unwrap();

        let convs = conversation::list(&conn, None).unwrap();
        assert_eq!(convs.len(), 1);
        assert_eq!(convs[0].id, "sess1");
        assert_eq!(convs[0].title.as_deref(), Some("Hello"));

        let msgs = message::list(&conn, "sess1").unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "user");
        assert_eq!(msgs[1].role, "assistant");
    }

    #[test]
    fn import_is_idempotent() {
        let conn = setup();
        let dir = tempdir().unwrap();
        let path = write_jsonl(dir.path(), "test.jsonl", &[LINE_U, LINE_A]);

        import_file(&conn, &path).unwrap();
        import_file(&conn, &path).unwrap(); // second import

        let msgs = message::list(&conn, "sess1").unwrap();
        assert_eq!(msgs.len(), 2); // no duplicates
    }

    #[test]
    fn custom_title_takes_priority_over_first_user_text() {
        let conn = setup();
        let dir = tempdir().unwrap();
        let path = write_jsonl(dir.path(), "test.jsonl", &[LINE_U, LINE_A, LINE_TITLE]);

        import_file(&conn, &path).unwrap();

        let convs = conversation::list(&conn, None).unwrap();
        assert_eq!(convs[0].title.as_deref(), Some("Fix clippy warnings in parser"));
    }

    #[test]
    fn import_all_skips_missing_dir() {
        let conn = setup();
        let result = import_all(&conn, Path::new("/nonexistent/path/xyz"));
        assert!(result.is_ok()); // should not error
    }
}
