use tauri::command;

/// Open a terminal emulator in the given directory.
/// If `command` is Some, execute it then keep shell alive.
/// Tries: x-terminal-emulator → gnome-terminal → xfce4-terminal → xterm
#[command]
pub fn open_in_terminal(path: String, command: Option<String>) -> Result<(), String> {
    // Build the shell invocation: run optional command, then exec $SHELL to keep terminal open
    let shell_cmd = match &command {
        Some(cmd) => format!("{cmd}; exec $SHELL"),
        None => "exec $SHELL".to_string(),
    };

    // Try terminals in priority order
    let spawned = try_terminal_xterm_emulator(&path, &shell_cmd)
        .or_else(|| try_terminal_gnome(&path, &shell_cmd))
        .or_else(|| try_terminal_xfce(&path, &shell_cmd))
        .or_else(|| try_terminal_xterm(&path, &shell_cmd));

    match spawned {
        Some(_) => Ok(()),
        None => Err(format!("No supported terminal found (tried x-terminal-emulator, gnome-terminal, xfce4-terminal, xterm). Path: {path}")),
    }
}

fn try_terminal_xterm_emulator(path: &str, shell_cmd: &str) -> Option<std::process::Child> {
    // x-terminal-emulator is the Debian/Ubuntu alternatives system entry
    std::process::Command::new("x-terminal-emulator")
        .arg("-e")
        .arg(format!("bash -c 'cd \"{path}\" && {shell_cmd}'"))
        .spawn()
        .ok()
}

fn try_terminal_gnome(path: &str, shell_cmd: &str) -> Option<std::process::Child> {
    std::process::Command::new("gnome-terminal")
        .arg(format!("--working-directory={path}"))
        .arg("--")
        .arg("bash")
        .arg("-c")
        .arg(shell_cmd)
        .spawn()
        .ok()
}

fn try_terminal_xfce(path: &str, shell_cmd: &str) -> Option<std::process::Child> {
    std::process::Command::new("xfce4-terminal")
        .arg(format!("--working-directory={path}"))
        .arg("-e")
        .arg(format!("bash -c '{shell_cmd}'"))
        .spawn()
        .ok()
}

fn try_terminal_xterm(path: &str, shell_cmd: &str) -> Option<std::process::Child> {
    std::process::Command::new("xterm")
        .arg("-e")
        .arg("bash")
        .arg("-c")
        .arg(format!("cd \"{path}\" && {shell_cmd}"))
        .spawn()
        .ok()
}
