use tauri::State;
use crate::AppState;
use crate::db::message;
use crate::domain::Message;

#[tauri::command]
pub fn list_messages(
    state: State<AppState>,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    message::list(&conn, &conversation_id).map_err(|e| e.to_string())
}
