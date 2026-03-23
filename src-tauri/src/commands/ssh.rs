use std::process::Command;
use crate::ssh::SshHost;

/// Return parsed SSH hosts from ~/.ssh/config
#[tauri::command]
pub fn parse_ssh_config() -> Result<Vec<SshHost>, String> {
    Ok(crate::ssh::parse_ssh_config())
}

/// Build the SSH destination string (user@host -p port)
fn ssh_destination(host: &str, user: Option<&str>, port: Option<u16>) -> Vec<String> {
    let mut args = Vec::new();
    if let Some(p) = port {
        args.push("-p".to_string());
        args.push(p.to_string());
    }
    match user {
        Some(u) => args.push(format!("{u}@{host}")),
        None => args.push(host.to_string()),
    }
    args
}

/// Execute a command on a remote host via SSH and return stdout.
/// Uses the system `ssh` command so it respects the user's keys, agent, and config.
#[tauri::command]
pub async fn ssh_exec(
    host: String,
    user: Option<String>,
    port: Option<u16>,
    command: String,
) -> Result<String, String> {
    let mut args = vec![
        "-o".to_string(), "BatchMode=yes".to_string(),
        "-o".to_string(), "ConnectTimeout=10".to_string(),
        "-o".to_string(), "StrictHostKeyChecking=accept-new".to_string(),
    ];
    args.extend(ssh_destination(&host, user.as_deref(), port));
    args.push(command);

    let output = tokio::task::spawn_blocking(move || {
        Command::new("ssh")
            .args(&args)
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {e}"))?
    .map_err(|e| format!("Failed to execute ssh: {e}"))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("SSH command failed ({}): {}", output.status, stderr.trim()))
    }
}

/// Test SSH connectivity to a host. Returns Ok(()) on success.
#[tauri::command]
pub async fn ssh_test_connection(
    host: String,
    user: Option<String>,
    port: Option<u16>,
) -> Result<String, String> {
    ssh_exec(host, user, port, "echo ok".to_string()).await
}

/// Discover remote Claude Code conversations.
/// Single SSH call: find JSONL files, then read head+tail of each for metadata.
#[tauri::command]
pub async fn ssh_discover_conversations(
    host: String,
    user: Option<String>,
    port: Option<u16>,
) -> Result<DiscoverResult, String> {
    // Single SSH call: find files, then for each read first 30 + last 10 lines
    // This captures session metadata (top) and recent timestamps (bottom)
    let script = r#"
echo "<<<ACTIVE_PIDS>>>"
ps aux 2>/dev/null | grep -E 'claude.*--resume' | grep -v grep | awk '{for(i=1;i<=NF;i++){if($i=="--resume"){print $(i+1);break}}}' || true
echo "<<<END_PIDS>>>"
files=$(find ~/.claude/projects -name '*.jsonl' -type f 2>/dev/null | grep -v 'observer-sessions' | grep -v '.claude-mem')
if [ -z "$files" ]; then exit 0; fi
for f in $files; do
  echo "<<<FILE:$f>>>"
  head -30 "$f" 2>/dev/null
  echo "<<<TAIL>>>"
  tail -10 "$f" 2>/dev/null
done
"#;

    let content = ssh_exec(host, user, port, script.to_string()).await?;

    if content.trim().is_empty() {
        return Ok(DiscoverResult { files: Vec::new(), active_session_ids: Vec::new() });
    }

    // Parse active session IDs first
    let mut active_session_ids: Vec<String> = Vec::new();
    let mut in_pids = false;

    // Parse the output
    let mut results = Vec::new();
    let mut current_path: Option<String> = None;
    let mut head_lines: Vec<String> = Vec::new();
    let mut tail_lines: Vec<String> = Vec::new();
    let mut in_tail = false;

    for line in content.lines() {
        if line == "<<<ACTIVE_PIDS>>>" {
            in_pids = true;
            continue;
        }
        if line == "<<<END_PIDS>>>" {
            in_pids = false;
            continue;
        }
        if in_pids {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                active_session_ids.push(trimmed.to_string());
            }
            continue;
        }

        if let Some(path) = line.strip_prefix("<<<FILE:").and_then(|s| s.strip_suffix(">>>")) {
            // Flush previous file
            if let Some(prev_path) = current_path.take() {
                let mut combined = head_lines.clone();
                combined.extend(tail_lines.clone());
                results.push(RemoteJsonlFile {
                    path: prev_path,
                    content: combined.join("\n"),
                });
                head_lines.clear();
                tail_lines.clear();
            }
            current_path = Some(path.to_string());
            in_tail = false;
        } else if line == "<<<TAIL>>>" {
            in_tail = true;
        } else if current_path.is_some() {
            if in_tail {
                tail_lines.push(line.to_string());
            } else {
                head_lines.push(line.to_string());
            }
        }
    }

    // Flush last file
    if let Some(path) = current_path {
        let mut combined = head_lines;
        combined.extend(tail_lines);
        results.push(RemoteJsonlFile {
            path,
            content: combined.join("\n"),
        });
    }

    Ok(DiscoverResult {
        files: results,
        active_session_ids,
    })
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct RemoteJsonlFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DiscoverResult {
    pub files: Vec<RemoteJsonlFile>,
    pub active_session_ids: Vec<String>,
}
