use std::sync::Mutex;
use rusqlite::Connection;
use tauri::Manager;

pub mod db;
pub mod domain;
pub mod importer;
pub mod watcher;
pub mod commands;
pub mod pty;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub pty_manager: pty::PtyManager,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();
    let conn = db::open().expect("failed to open database");
    db::migrations::run(&conn).expect("failed to run migrations");
    let state = AppState { db: Mutex::new(conn), pty_manager: pty::PtyManager::new() };
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::workspaces::list_workspaces,
            commands::conversations::list_conversations,
            commands::conversations::pin_conversation,
            commands::conversations::archive_conversation,
            commands::messages::list_messages,
            commands::search::search_messages,
            commands::shell::open_in_terminal,
            commands::pty::pty_create,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_kill,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let Some(home) = dirs::home_dir() else {
                log::error!("Cannot determine home directory; skipping initial import");
                return Ok(());
            };
            let data_dir = home.join(".claude").join("projects");

            // Run initial import synchronously
            {
                let state = handle.state::<AppState>();
                let conn = state.db.lock().unwrap();
                if let Err(e) = importer::sync::import_all(&conn, &data_dir) {
                    log::error!("Initial import failed: {e}");
                }
            }

            // Start file watcher
            watcher::start(handle.clone(), data_dir);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
