use std::path::PathBuf;
use std::time::Duration;
use notify::{Watcher, RecursiveMode, RecommendedWatcher};
use notify::event::{EventKind, CreateKind, ModifyKind};
use tauri::{AppHandle, Emitter, Manager};

use crate::AppState;
use crate::importer::sync;
use crate::db::conversation;

#[derive(Clone, serde::Serialize)]
struct ConversationUpdatedPayload {
    conversation_id: String,
}

pub fn start(app: AppHandle, watch_path: PathBuf) {
    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = RecommendedWatcher::new(tx, notify::Config::default()
            .with_poll_interval(Duration::from_millis(500)))
            .expect("failed to create watcher");

        watcher.watch(&watch_path, RecursiveMode::Recursive)
            .expect("failed to watch path");

        log::info!("Watching: {}", watch_path.display());

        for res in rx {
            match res {
                Ok(event) => handle_event(&app, event),
                Err(e) => log::error!("Watch error: {e}"),
            }
        }
    });
}

fn handle_event(app: &AppHandle, event: notify::Event) {
    let state = app.state::<AppState>();

    for path in &event.paths {
        if path.extension().map_or(true, |e| e != "jsonl") {
            continue;
        }

        match event.kind {
            EventKind::Create(CreateKind::File) | EventKind::Modify(ModifyKind::Data(_)) => {
                let conn = state.db.lock().unwrap();
                if let Err(e) = sync::import_file(&conn, path) {
                    log::error!("Watch import failed for {}: {e}", path.display());
                    return;
                }

                // Emit update event to frontend
                let path_str = path.to_string_lossy().to_string();
                if let Ok(convs) = conversation::list(&conn, None) {
                    if let Some(conv) = convs.iter().find(|c| c.jsonl_path == path_str) {
                        let _ = app.emit("conversation:updated", ConversationUpdatedPayload {
                            conversation_id: conv.id.clone(),
                        });
                    }
                }
                // Always emit list refresh
                let _ = app.emit("conversations:changed", ());
            }
            EventKind::Remove(_) => {
                let conn = state.db.lock().unwrap();
                let path_str = path.to_string_lossy().to_string();
                conn.execute(
                    "UPDATE conversations SET archived=1 WHERE jsonl_path=?1",
                    rusqlite::params![path_str],
                ).ok();
                let _ = app.emit("conversations:changed", ());
            }
            _ => {}
        }
    }
}
