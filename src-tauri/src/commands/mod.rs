pub mod conversations;
pub mod messages;
pub mod workspaces;

use tauri::command;

#[command]
pub fn search_messages(_query: String) -> Vec<serde_json::Value> {
    vec![]
}
