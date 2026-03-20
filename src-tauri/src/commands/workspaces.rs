use tauri::State;
use crate::AppState;
use crate::db::workspace;
use crate::domain::Workspace;

#[tauri::command]
pub fn list_workspaces(state: State<AppState>) -> Result<Vec<Workspace>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    workspace::list(&conn).map_err(|e| e.to_string())
}
