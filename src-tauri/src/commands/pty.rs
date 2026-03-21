use tauri::{command, AppHandle, State};
use crate::AppState;

#[command]
pub fn pty_create(
    app: AppHandle,
    state: State<AppState>,
    session_id: String,
    cwd: String,
    command: Option<String>,
) -> Result<(), String> {
    state.pty_manager.create(app, session_id, cwd, command)
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
