use anyhow::Result;
use rusqlite::Connection;

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    // Idempotent column additions (ALTER TABLE doesn't support IF NOT EXISTS)
    let env_col_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('conversations') WHERE name='env_vars'",
        [],
        |r| r.get::<_, i64>(0),
    ).unwrap_or(0) > 0;
    if !env_col_exists {
        conn.execute("ALTER TABLE conversations ADD COLUMN env_vars TEXT NOT NULL DEFAULT ''", [])?;
    }
    Ok(())
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS workspaces (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    root_path     TEXT NOT NULL UNIQUE,
    git_repo_root TEXT,
    updated_at    INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    workspace_id    TEXT REFERENCES workspaces(id),
    provider        TEXT NOT NULL DEFAULT 'claude_code',
    title           TEXT,
    status          TEXT NOT NULL DEFAULT 'idle',
    branch_name     TEXT,
    pinned          INTEGER NOT NULL DEFAULT 0,
    archived        INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER,
    jsonl_path      TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL REFERENCES conversations(id),
    parent_id           TEXT,
    role                TEXT NOT NULL,
    content_text        TEXT,
    content_json        TEXT,
    token_count_input   INTEGER,
    token_count_output  INTEGER,
    seq                 INTEGER NOT NULL,
    created_at          INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content_text,
    conversation_id UNINDEXED,
    id UNINDEXED
);

CREATE INDEX IF NOT EXISTS idx_conv_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated   ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv       ON messages(conversation_id, seq);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn migrations_run_twice_without_error() {
        let conn = open_in_memory().unwrap();
        run(&conn).unwrap();
        run(&conn).unwrap(); // idempotent
    }

    #[test]
    fn all_tables_created() {
        let conn = open_in_memory().unwrap();
        run(&conn).unwrap();

        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .flatten()
            .collect();

        assert!(tables.contains(&"workspaces".to_string()));
        assert!(tables.contains(&"conversations".to_string()));
        assert!(tables.contains(&"messages".to_string()));
    }
}
