use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    sessions: Mutex<HashMap<String, PtySession>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    /// Spawn a new PTY session. Kills any existing session with the same id first.
    pub fn create(
        &self,
        app: AppHandle,
        session_id: String,
        cwd: String,
        command: Option<String>,
    ) -> Result<(), String> {
        // Kill existing session if any
        self.kill(&session_id);

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;

        let mut cmd = CommandBuilder::new("bash");
        // If a command is given, run it then exec $SHELL so the terminal stays alive.
        let shell_cmd = match command {
            Some(c) => format!("{c}; exec $SHELL"),
            None => "exec $SHELL".to_string(),
        };
        cmd.args(["-c", &shell_cmd]);
        cmd.cwd(&cwd);

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| e.to_string())?;

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        // Stream PTY output to frontend via Tauri events
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        // Send raw bytes as base64 to avoid UTF-8 issues with ANSI sequences
                        let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = app.emit(&format!("pty:output:{sid}"), data);
                    }
                }
            }
            let _ = app.emit(&format!("pty:exit:{sid}"), ());
        });

        let session = PtySession {
            master: pair.master,
            writer,
        };
        self.sessions.lock().unwrap().insert(session_id, session);
        Ok(())
    }

    /// Write data to a PTY session's stdin.
    pub fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.writer.write_all(data).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Resize the PTY.
    pub fn resize(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get(session_id) {
            session
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// Kill and remove a PTY session.
    pub fn kill(&self, session_id: &str) {
        self.sessions.lock().unwrap().remove(session_id);
        // Dropping PtySession closes master fd, which sends SIGHUP to child
    }

    /// Check if a session is alive.
    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(session_id)
    }
}
