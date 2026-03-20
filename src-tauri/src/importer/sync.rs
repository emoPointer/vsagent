use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

pub fn import_all(_conn: &Connection, _data_dir: &Path) -> Result<()> {
    Ok(())
}
