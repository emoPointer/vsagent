use tauri::command;

/// Open a terminal emulator in the given directory.
/// Tries common Linux terminals in order.
#[command]
pub fn open_in_terminal(path: String) -> Result<(), String> {
    let xterm_cmd = format!("cd '{}' && exec $SHELL", path);

    let attempts: &[(&str, Vec<&str>)] = &[
        ("gnome-terminal", vec!["--working-directory", &path]),
        ("konsole", vec!["--workdir", &path]),
        ("xfce4-terminal", vec!["--working-directory", &path]),
        ("xterm", vec!["-e", "sh", "-c", &xterm_cmd]),
    ];

    for (term, args) in attempts {
        if std::process::Command::new(term).args(args).spawn().is_ok() {
            return Ok(());
        }
    }

    Err(format!("No supported terminal found. Path: {}", path))
}
