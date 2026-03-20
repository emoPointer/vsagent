use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub git_repo_root: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub workspace_id: Option<String>,
    pub provider: String,
    pub title: Option<String>,
    pub status: String,
    pub branch_name: Option<String>,
    pub pinned: bool,
    pub archived: bool,
    pub last_message_at: Option<i64>,
    pub jsonl_path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub parent_id: Option<String>,
    pub role: String,
    pub content_text: Option<String>,
    pub content_json: Option<String>,
    pub token_count_input: Option<i64>,
    pub token_count_output: Option<i64>,
    pub seq: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub message_id: String,
    pub conversation_id: String,
    pub conversation_title: Option<String>,
    pub role: String,
    pub snippet: String,
    pub rank: f64,
}
