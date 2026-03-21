use tauri::State;
use crate::AppState;
use crate::db::conversation;
use crate::domain::Conversation;

#[tauri::command]
pub fn list_conversations(
    state: State<AppState>,
    workspace_id: Option<String>,
) -> Result<Vec<Conversation>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::list(&conn, workspace_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pin_conversation(
    state: State<AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::set_pinned(&conn, &id, pinned).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn archive_conversation(
    state: State<AppState>,
    id: String,
    archived: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::set_archived(&conn, &id, archived).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_conversation(
    state: State<AppState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::rename(&conn, &id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_conversation(
    state: State<AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::delete(&conn, &id).map_err(|e| e.to_string())
}
