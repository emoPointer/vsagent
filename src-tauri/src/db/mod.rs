use anyhow::Result;
use rusqlite::Connection;
use dirs::home_dir;

pub mod migrations;
pub mod workspace;
pub mod conversation;
pub mod message;

pub fn open() -> Result<Connection> {
    let db_path = home_dir()
        .ok_or_else(|| anyhow::anyhow!("cannot find home dir"))?
        .join(".vsagent")
        .join("vsagent.db");

    std::fs::create_dir_all(db_path.parent().unwrap())?;
    let conn = Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}
