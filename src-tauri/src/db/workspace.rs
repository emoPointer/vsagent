use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::Workspace;

pub fn upsert(conn: &Connection, ws: &Workspace) -> Result<()> {
    conn.execute(
        "INSERT INTO workspaces (id, name, root_path, git_repo_root, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           git_repo_root = excluded.git_repo_root,
           updated_at = excluded.updated_at",
        params![ws.id, ws.name, ws.root_path, ws.git_repo_root, ws.updated_at, ws.created_at],
    )?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, root_path, git_repo_root, created_at, updated_at
         FROM workspaces ORDER BY name"
    )?;
    let rows = stmt.query_map([], |row| Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        root_path: row.get(2)?,
        git_repo_root: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    }))?;
    Ok(rows.flatten().collect())
}

pub fn find_by_path(conn: &Connection, root_path: &str) -> Result<Option<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, root_path, git_repo_root, created_at, updated_at
         FROM workspaces WHERE root_path = ?1"
    )?;
    let mut rows = stmt.query_map(params![root_path], |row| Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        root_path: row.get(2)?,
        git_repo_root: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    }))?;
    Ok(rows.next().and_then(|r| r.ok()))
}
