use serde::Deserialize;
use serde_json::Value;
use crate::domain::Message;

/// Raw JSONL line structure from Claude Code
#[derive(Debug, Deserialize)]
pub struct RawLine {
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "type")]
    pub line_type: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
    pub message: Option<RawMessage>,
}

#[derive(Debug, Deserialize)]
pub struct RawMessage {
    pub role: Option<String>,
    pub content: Option<Value>,
    pub usage: Option<RawUsage>,
}

#[derive(Debug, Deserialize)]
pub struct RawUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

/// Parsed line result - either a message or metadata-only
pub struct ParsedLine {
    pub message: Option<Message>,
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub timestamp_ms: Option<i64>,
}

/// Roles we accept as messages
fn is_message_role(role: &str) -> bool {
    matches!(role, "user" | "assistant" | "system")
}

/// Extract plain text from content (array or string)
pub fn extract_text(content: &Value) -> String {
    match content {
        Value::String(s) => s.clone(),
        Value::Array(blocks) => {
            blocks.iter().filter_map(|block| {
                let t = block.get("type")?.as_str()?;
                match t {
                    "text" => block.get("text")?.as_str().map(String::from),
                    "tool_use" => {
                        let name = block.get("name")?.as_str().unwrap_or("unknown");
                        Some(format!("[tool: {name}]"))
                    }
                    "tool_result" => {
                        let inner = block.get("content")?;
                        match inner {
                            Value::String(s) => Some(s.clone()),
                            _ => Some("[tool_result]".into()),
                        }
                    }
                    _ => None,
                }
            }).collect::<Vec<_>>().join("\n")
        }
        _ => String::new(),
    }
}

/// Normalize content to a JSON array string for storage
pub fn normalize_content_json(content: &Value) -> String {
    match content {
        Value::Array(_) => serde_json::to_string(content).unwrap_or_default(),
        Value::String(s) => {
            serde_json::to_string(&serde_json::json!([{"type": "text", "text": s}]))
                .unwrap_or_default()
        }
        _ => "[]".into(),
    }
}

/// Parse a single JSONL line string
pub fn parse_line(line: &str, seq: i64) -> Option<ParsedLine> {
    let raw: RawLine = serde_json::from_str(line)
        .map_err(|e| log::warn!("JSONL parse error: {e} on: {}", &line[..line.len().min(80)]))
        .ok()?;

    // Skip sidechains (subagent conversations)
    if raw.is_sidechain == Some(true) {
        return None;
    }

    let ts_ms = raw.timestamp.as_ref().and_then(|ts| {
        chrono::DateTime::parse_from_rfc3339(ts).ok().map(|dt| dt.timestamp_millis())
    });

    let mut result = ParsedLine {
        message: None,
        session_id: raw.session_id.clone(),
        cwd: raw.cwd.clone(),
        git_branch: raw.git_branch.clone(),
        timestamp_ms: ts_ms,
    };

    // Only user/assistant/system produce messages
    if !matches!(raw.line_type.as_str(), "user" | "assistant" | "system") {
        return Some(result);
    }

    let msg_raw = raw.message.as_ref()?;
    let role = msg_raw.role.as_deref()?;
    if !is_message_role(role) {
        return Some(result);
    }

    let id = raw.uuid.clone().unwrap_or_else(|| format!("auto-{seq}"));
    let session_id = raw.session_id.clone().unwrap_or_default();

    let (content_text, content_json) = match &msg_raw.content {
        Some(c) => {
            let text = extract_text(c);
            let json = normalize_content_json(c);
            (
                if text.is_empty() { None } else { Some(text) },
                if json == "[]" { None } else { Some(json) },
            )
        }
        None => (None, None),
    };

    let (token_in, token_out) = msg_raw.usage.as_ref().map_or((None, None), |u| {
        (u.input_tokens, u.output_tokens)
    });

    result.message = Some(Message {
        id,
        conversation_id: session_id,
        parent_id: raw.parent_uuid.clone(),
        role: role.to_string(),
        content_text,
        content_json,
        token_count_input: token_in,
        token_count_output: token_out,
        seq,
        created_at: ts_ms.unwrap_or(0),
    });

    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const USER_LINE: &str = r#"{"uuid":"u1","parentUuid":null,"type":"user","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:00Z","isSidechain":false,"message":{"role":"user","content":"Hello Claude"}}"#;

    const ASSISTANT_LINE: &str = r#"{"uuid":"a1","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:01Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"text","text":"Hello! How can I help?"}],"usage":{"input_tokens":10,"output_tokens":20}}}"#;

    const TOOL_USE_LINE: &str = r#"{"uuid":"a2","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:02Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":{"path":"/foo"}}]}}"#;

    const PROGRESS_LINE: &str = r#"{"type":"progress","sessionId":"sess1","data":{"type":"hook_progress"}}"#;

    const SIDECHAIN_LINE: &str = r#"{"uuid":"s1","type":"user","sessionId":"sess1","isSidechain":true,"message":{"role":"user","content":"sidechain"}}"#;

    const CORRUPT_LINE: &str = r#"{"this is not valid json"#;

    #[test]
    fn parses_user_message() {
        let result = parse_line(USER_LINE, 0).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.role, "user");
        assert_eq!(msg.content_text.unwrap(), "Hello Claude");
        assert_eq!(msg.conversation_id, "sess1");
        assert_eq!(msg.seq, 0);
    }

    #[test]
    fn parses_assistant_message_with_usage() {
        let result = parse_line(ASSISTANT_LINE, 1).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.role, "assistant");
        assert!(msg.content_text.as_deref().unwrap().contains("Hello"));
        assert_eq!(msg.token_count_input, Some(10));
        assert_eq!(msg.token_count_output, Some(20));
    }

    #[test]
    fn parses_tool_use_as_bracket_notation() {
        let result = parse_line(TOOL_USE_LINE, 2).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.content_text.as_deref().unwrap(), "[tool: Read]");
    }

    #[test]
    fn progress_line_returns_no_message() {
        let result = parse_line(PROGRESS_LINE, 3).unwrap();
        assert!(result.message.is_none());
        assert_eq!(result.session_id.unwrap(), "sess1");
    }

    #[test]
    fn sidechain_line_is_skipped() {
        let result = parse_line(SIDECHAIN_LINE, 4);
        assert!(result.is_none());
    }

    #[test]
    fn corrupt_line_returns_none() {
        let result = parse_line(CORRUPT_LINE, 5);
        assert!(result.is_none());
    }

    #[test]
    fn extracts_metadata_from_non_message_lines() {
        let result = parse_line(PROGRESS_LINE, 0).unwrap();
        assert_eq!(result.session_id.unwrap(), "sess1");
    }
}
