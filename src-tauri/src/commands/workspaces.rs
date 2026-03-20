use tauri::command;

#[command]
pub fn list_workspaces() -> Vec<serde_json::Value> {
    vec![]
}
