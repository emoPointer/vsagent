use tauri::command;

#[command]
pub fn list_messages(_conversation_id: String) -> Vec<serde_json::Value> {
    vec![]
}
