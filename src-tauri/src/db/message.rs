use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::{Message, SearchResult};

pub fn insert_ignore(conn: &Connection, m: &Message) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO messages
           (id, conversation_id, parent_id, role, content_text, content_json,
            token_count_input, token_count_output, seq, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            m.id, m.conversation_id, m.parent_id, m.role,
            m.content_text, m.content_json,
            m.token_count_input, m.token_count_output,
            m.seq, m.created_at
        ],
    )?;

    // Sync to FTS if inserted
    if !m.content_text.as_ref().map_or(true, |t| t.is_empty()) {
        conn.execute(
            "INSERT OR IGNORE INTO messages_fts(content_text, conversation_id, id)
             VALUES (?1, ?2, ?3)",
            params![m.content_text, m.conversation_id, m.id],
        )?;
    }
    Ok(())
}

pub fn count_for_conversation(conn: &Connection, conversation_id: &str) -> Result<i64> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM messages WHERE conversation_id=?1",
        params![conversation_id],
        |r| r.get(0),
    )?;
    Ok(count)
}

pub fn list(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, parent_id, role, content_text, content_json,
                token_count_input, token_count_output, seq, created_at
         FROM messages WHERE conversation_id=?1 ORDER BY seq"
    )?;
    let rows = stmt.query_map(params![conversation_id], |row| Ok(Message {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        parent_id: row.get(2)?,
        role: row.get(3)?,
        content_text: row.get(4)?,
        content_json: row.get(5)?,
        token_count_input: row.get(6)?,
        token_count_output: row.get(7)?,
        seq: row.get(8)?,
        created_at: row.get(9)?,
    }))?;
    Ok(rows.flatten().collect())
}

pub fn search(conn: &Connection, query: &str, limit: i64) -> Result<Vec<SearchResult>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.conversation_id, c.title, m.role,
                snippet(messages_fts, 0, '<b>', '</b>', '...', 20),
                rank
         FROM messages_fts f
         JOIN messages m ON m.id = f.id
         JOIN conversations c ON c.id = f.conversation_id
         WHERE messages_fts MATCH ?1
         ORDER BY rank LIMIT ?2"
    )?;
    let rows = stmt.query_map(params![query, limit], |row| Ok(SearchResult {
        message_id: row.get(0)?,
        conversation_id: row.get(1)?,
        conversation_title: row.get(2)?,
        role: row.get(3)?,
        snippet: row.get(4)?,
        rank: row.get(5)?,
    }))?;
    Ok(rows.flatten().collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, migrations};

    fn setup() -> Connection {
        let conn = open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        // Insert prerequisite conversation
        conn.execute(
            "INSERT INTO conversations(id,provider,status,jsonl_path,created_at,updated_at)
             VALUES('conv1','claude_code','idle','/tmp/test.jsonl',0,0)",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn insert_and_list_messages() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "user".into(),
            content_text: Some("Hello world".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        let msgs = list(&conn, "conv1").unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].role, "user");
    }

    #[test]
    fn insert_ignore_is_idempotent() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "user".into(),
            content_text: Some("Hello".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        insert_ignore(&conn, &msg).unwrap(); // should not error or duplicate
        assert_eq!(count_for_conversation(&conn, "conv1").unwrap(), 1);
    }

    #[test]
    fn fts_search_returns_results() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "assistant".into(),
            content_text: Some("The quick brown fox jumps".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        let results = search(&conn, "quick brown", 10).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].snippet.contains("quick") || results[0].snippet.contains("brown"));
    }
}
