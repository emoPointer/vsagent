use portable_pty::{ChildKiller, CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    /// Set to true on kill() so the reader thread stops emitting events
    /// immediately, even while waiting for the child process to die and
    /// the blocking read() to return EIO. This prevents "zombie" event
    /// emissions in the window between kill() and thread exit.
    killed: Arc<AtomicBool>,
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
        rows: u16,
        cols: u16,
    ) -> Result<(), String> {
        // Kill existing session if any
        self.kill(&session_id);

        let pty_system = NativePtySystem::default();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
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
        // Ensure proper terminal type and UTF-8 locale for correct CJK character width
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| e.to_string())?;
        // clone_killer gives a Send+Sync handle to kill the child later
        let killer = child.clone_killer();

        let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;

        let killed = Arc::new(AtomicBool::new(false));
        let killed_clone = killed.clone();

        // Stream PTY output to frontend via Tauri events.
        // The `killed` flag lets kill() immediately silence this thread even
        // while the blocking read() hasn't returned EIO yet.
        let sid = session_id.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        // Stop emitting as soon as kill() is called
                        if killed_clone.load(Ordering::Relaxed) { break; }
                        let data = String::from_utf8_lossy(&buf[..n]).into_owned();
                        let _ = app.emit(&format!("pty:output:{sid}"), data);
                    }
                }
            }
            // Only emit exit for natural process exits, not intentional kills
            if !killed_clone.load(Ordering::Relaxed) {
                let _ = app.emit(&format!("pty:exit:{sid}"), ());
            }
        });

        let session = PtySession {
            master: pair.master,
            writer,
            killer,
            killed,
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
        if let Some(mut session) = self.sessions.lock().unwrap().remove(session_id) {
            // 1. Set flag first — reader thread stops emitting immediately,
            //    even before the blocking read() returns EIO.
            session.killed.store(true, Ordering::Relaxed);
            // 2. Kill child process — slave fd closes → reader gets EIO → thread exits
            let _ = session.killer.kill();
            // 3. Dropping session closes master fd
        }
    }

    /// Check if a session is alive.
    pub fn has_session(&self, session_id: &str) -> bool {
        self.sessions.lock().unwrap().contains_key(session_id)
    }
}
