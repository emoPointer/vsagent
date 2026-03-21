use tauri::command;
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

/// Save raw image bytes to a temp file under /tmp/vsagent/.
/// Returns the absolute path of the saved file.
#[command]
pub fn save_temp_image(data: Vec<u8>, ext: String) -> Result<String, String> {
    let tmp_dir = std::env::temp_dir().join("vsagent");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let ext = sanitize_ext(&ext);
    let filename = format!("{}.{}", ts, ext);
    let path = tmp_dir.join(&filename);

    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Read an image from the system clipboard using native CLI tools.
/// On Wayland uses `wl-paste --type image/png`.
/// On X11 uses `xclip -selection clipboard -t image/png -o`.
/// Saves the image to /tmp/vsagent/ and returns the absolute path.
#[command]
pub fn read_clipboard_image() -> Result<String, String> {
    let is_wayland = std::env::var("WAYLAND_DISPLAY")
        .map(|v| !v.is_empty())
        .unwrap_or(false);

    let output = if is_wayland {
        Command::new("wl-paste")
            .args(["--type", "image/png"])
            .output()
            .map_err(|e| format!("wl-paste not available: {e}"))?
    } else {
        Command::new("xclip")
            .args(["-selection", "clipboard", "-t", "image/png", "-o"])
            .output()
            .map_err(|e| format!("xclip not available: {e}"))?
    };

    if !output.status.success() || output.stdout.is_empty() {
        return Err("no image in clipboard".to_string());
    }

    let tmp_dir = std::env::temp_dir().join("vsagent");
    std::fs::create_dir_all(&tmp_dir).map_err(|e| e.to_string())?;

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let path = tmp_dir.join(format!("{}.png", ts));
    std::fs::write(&path, &output.stdout).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn sanitize_ext(ext: &str) -> &str {
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        "gif" => "gif",
        "webp" => "webp",
        _ => "png",
    }
}
