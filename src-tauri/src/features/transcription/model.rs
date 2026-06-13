use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use tauri::{AppHandle, Emitter, Manager};

const MODEL_FILE_NAME: &str = "ggml-large-v3-turbo-q5_0.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin?download=true";

#[derive(Clone, serde::Serialize)]
pub struct ModelDownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub progress: Option<u8>,
}

fn download_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

pub fn model_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("models").join(MODEL_FILE_NAME))
        .map_err(|e| e.to_string())
}

pub fn ensure_model_available(app: &AppHandle) -> Result<PathBuf, String> {
    ensure_model_available_inner(app, false)
}

fn ensure_model_available_inner(app: &AppHandle, emit_progress: bool) -> Result<PathBuf, String> {
    let path = model_path(app)?;
    if path.exists() {
        if emit_progress {
            let _ = app.emit(
                "model-download-progress",
                ModelDownloadProgress {
                    downloaded_bytes: fs::metadata(&path)
                        .map(|metadata| metadata.len())
                        .unwrap_or(0),
                    total_bytes: fs::metadata(&path).map(|metadata| metadata.len()).ok(),
                    progress: Some(100),
                },
            );
        }
        return Ok(path);
    }

    let _guard = download_lock().lock().map_err(|e| e.to_string())?;
    if path.exists() {
        return Ok(path);
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Model path has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let temp_path = path.with_extension("bin.download");
    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(|e| e.to_string())?;
    }

    let mut response = reqwest::blocking::get(MODEL_URL).map_err(|e| e.to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Failed to download transcription model: {}",
            response.status()
        ));
    }

    let total_bytes = response.content_length();

    let mut temp_file = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    let mut downloaded_bytes = 0;
    let mut buffer = [0; 64 * 1024];

    loop {
        let bytes_read = response.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }

        temp_file
            .write_all(&buffer[..bytes_read])
            .map_err(|e| e.to_string())?;
        downloaded_bytes += bytes_read as u64;

        if emit_progress {
            let progress =
                total_bytes.map(|total| ((downloaded_bytes * 100) / total).min(100) as u8);
            let _ = app.emit(
                "model-download-progress",
                ModelDownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                    progress,
                },
            );
        }
    }

    temp_file.flush().map_err(|e| e.to_string())?;

    let bytes_written = downloaded_bytes;
    if bytes_written == 0 {
        let _ = fs::remove_file(&temp_path);
        return Err("Downloaded transcription model was empty.".to_string());
    }

    fs::rename(&temp_path, &path).map_err(|e| e.to_string())?;

    if emit_progress {
        let _ = app.emit(
            "model-download-progress",
            ModelDownloadProgress {
                downloaded_bytes: bytes_written,
                total_bytes: Some(bytes_written),
                progress: Some(100),
            },
        );
    }

    Ok(path)
}

#[tauri::command]
pub async fn ensure_transcription_model(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ensure_model_available_inner(&app, true).map(|_| ())
    })
    .await
    .map_err(|e| e.to_string())?
}
