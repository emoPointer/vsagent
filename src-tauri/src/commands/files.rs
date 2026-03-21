use tauri::command;
use std::time::{SystemTime, UNIX_EPOCH};

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

fn sanitize_ext(ext: &str) -> &str {
    match ext.to_ascii_lowercase().as_str() {
        "jpg" | "jpeg" => "jpg",
        "png" => "png",
        "gif" => "gif",
        "webp" => "webp",
        _ => "png",
    }
}
