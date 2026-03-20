pub mod migrations;

use anyhow::Result;
use rusqlite::Connection;

pub fn open() -> Result<Connection> {
    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap().join(".local").join("share"))
        .join("vsagent");
    std::fs::create_dir_all(&data_dir)?;
    let db_path = data_dir.join("vsagent.db");
    let conn = Connection::open(&db_path)?;
    Ok(conn)
}
