use tauri::command;

#[command]
pub fn list_conversations(_workspace_id: String) -> Vec<serde_json::Value> {
    vec![]
}

#[command]
pub fn pin_conversation(_id: String) -> Result<(), String> {
    Ok(())
}

#[command]
pub fn archive_conversation(_id: String) -> Result<(), String> {
    Ok(())
}
