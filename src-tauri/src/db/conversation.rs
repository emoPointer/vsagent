use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::Conversation;

pub fn upsert(conn: &Connection, c: &Conversation) -> Result<()> {
    conn.execute(
        "INSERT INTO conversations
           (id, workspace_id, provider, title, status, branch_name, pinned, archived,
            last_message_at, jsonl_path, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
           title = COALESCE(excluded.title, title),
           branch_name = excluded.branch_name,
           last_message_at = excluded.last_message_at,
           updated_at = excluded.updated_at",
        params![
            c.id, c.workspace_id, c.provider, c.title, c.status,
            c.branch_name, c.pinned as i64, c.archived as i64,
            c.last_message_at, c.jsonl_path, c.created_at, c.updated_at
        ],
    )?;
    Ok(())
}

fn row_to_conversation(row: &rusqlite::Row) -> rusqlite::Result<Conversation> {
    Ok(Conversation {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        provider: row.get(2)?,
        title: row.get(3)?,
        status: row.get(4)?,
        branch_name: row.get(5)?,
        pinned: row.get::<_, i64>(6)? != 0,
        archived: row.get::<_, i64>(7)? != 0,
        last_message_at: row.get(8)?,
        jsonl_path: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn list(conn: &Connection, workspace_id: Option<&str>) -> Result<Vec<Conversation>> {
    match workspace_id {
        Some(wid) => {
            let mut stmt = conn.prepare(
                "SELECT id,workspace_id,provider,title,status,branch_name,pinned,archived,
                        last_message_at,jsonl_path,created_at,updated_at
                 FROM conversations WHERE workspace_id=?1 AND archived=0
                 ORDER BY updated_at DESC",
            )?;
            let rows = stmt.query_map(params![wid], row_to_conversation)?;
            Ok(rows.flatten().collect())
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id,workspace_id,provider,title,status,branch_name,pinned,archived,
                        last_message_at,jsonl_path,created_at,updated_at
                 FROM conversations WHERE archived=0
                 ORDER BY pinned DESC, updated_at DESC",
            )?;
            let rows = stmt.query_map([], row_to_conversation)?;
            Ok(rows.flatten().collect())
        }
    }
}

pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<()> {
    conn.execute(
        "UPDATE conversations SET pinned=?1 WHERE id=?2",
        params![pinned as i64, id],
    )?;
    Ok(())
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool) -> Result<()> {
    conn.execute(
        "UPDATE conversations SET archived=?1 WHERE id=?2",
        params![archived as i64, id],
    )?;
    Ok(())
}

pub fn rename(conn: &Connection, id: &str, title: &str) -> Result<()> {
    conn.execute(
        "UPDATE conversations SET title=?1, updated_at=strftime('%s','now') WHERE id=?2",
        params![title, id],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM messages WHERE conversation_id=?1", params![id])?;
    conn.execute("DELETE FROM conversations WHERE id=?1", params![id])?;
    Ok(())
}

pub fn exists(conn: &Connection, id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM conversations WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}
