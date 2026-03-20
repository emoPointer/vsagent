use tauri::State;
use crate::AppState;
use crate::db::message;
use crate::domain::SearchResult;

#[tauri::command]
pub fn search_messages(
    state: State<AppState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    message::search(&conn, &query, 50).map_err(|e| e.to_string())
}
