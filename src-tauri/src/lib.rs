use std::sync::Mutex;
use rusqlite::Connection;
use tauri::Manager;

pub mod db;
pub mod domain;
pub mod importer;
pub mod watcher;
pub mod commands;

pub struct AppState {
    pub db: Mutex<Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    let conn = db::open().expect("failed to open database");
    db::migrations::run(&conn).expect("failed to run migrations");
    let state = AppState { db: Mutex::new(conn) };
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::workspaces::list_workspaces,
            commands::conversations::list_conversations,
            commands::conversations::pin_conversation,
            commands::conversations::archive_conversation,
            commands::messages::list_messages,
            commands::search_messages,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let Some(home) = dirs::home_dir() else {
                log::error!("Cannot determine home directory; skipping initial import");
                return Ok(());
            };
            let data_dir = home.join(".claude").join("projects");
            let handle2 = handle.clone();
            tauri::async_runtime::spawn(async move {
                let result = tauri::async_runtime::spawn_blocking(move || {
                    let state = handle2.state::<AppState>();
                    let conn = state.db.lock().unwrap();
                    importer::sync::import_all(&conn, &data_dir)
                }).await;
                match result {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => log::error!("Initial import failed: {e}"),
                    Err(e) => log::error!("Import task panicked: {e}"),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
