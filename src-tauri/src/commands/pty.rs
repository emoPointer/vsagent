use tauri::{command, AppHandle, State};
use crate::AppState;

/// Parse KEY=VALUE text (newline-separated) into pairs.
/// Empty lines and lines starting with '#' are ignored.
fn parse_env_text(text: &str) -> Vec<(String, String)> {
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (k, v) = line.split_once('=')?;
            let k = k.trim().to_string();
            if k.is_empty() { return None; }
            Some((k, v.trim().to_string()))
        })
        .collect()
}

#[command]
pub fn pty_create(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    cwd: String,
    command: Option<String>,
    env_text: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<(), String> {
    let env_vars = parse_env_text(env_text.as_deref().unwrap_or(""));
    state.pty_manager.create(app, session_id, cwd, command, env_vars, rows.unwrap_or(24), cols.unwrap_or(80))
}

#[command]
pub fn pty_write(
    state: State<AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.pty_manager.write(&session_id, data.as_bytes())
}

#[command]
pub fn pty_resize(
    state: State<AppState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    state.pty_manager.resize(&session_id, rows, cols)
}

#[command]
pub fn pty_kill(state: State<AppState>, session_id: String) {
    state.pty_manager.kill(&session_id);
}
