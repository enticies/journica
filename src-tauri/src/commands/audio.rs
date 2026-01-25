use serde::Serialize;
use sqlx::SqlitePool;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use uuid::Uuid;

use super::db::Entry;
use crate::{transcription, AppState, AudioCommand};

#[derive(Clone, Serialize)]
pub struct RecordingInfo {
    pub id: String,
    pub filename: String,
    pub created_at: i64,
}

fn timestamp_filename(secs: i64) -> String {
    let secs = secs as u64;
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let mut year = 1970;
    let mut remaining_days = days_since_epoch as i32;

    loop {
        let days_in_year = if year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) {
            366
        } else {
            365
        };
        if remaining_days < days_in_year {
            break;
        }
        remaining_days -= days_in_year;
        year += 1;
    }

    let is_leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_months: [i32; 12] = [
        31,
        if is_leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];

    let mut month = 0;
    for (i, &days) in days_in_months.iter().enumerate() {
        if remaining_days < days {
            month = i + 1;
            break;
        }
        remaining_days -= days;
    }
    let day = remaining_days + 1;

    format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}.wav",
        year, month, day, hours, minutes, seconds
    )
}

#[tauri::command]
pub fn start_recording(
    app: tauri::AppHandle,
    state: tauri::State<Mutex<AppState>>,
) -> Result<RecordingInfo, String> {
    let id = Uuid::new_v4().to_string();
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let filename = timestamp_filename(created_at);

    let recordings_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");

    std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let file_path = recordings_dir.join(&filename);

    let mut state = state.lock().unwrap();
    state.current_recording = Some(RecordingInfo {
        id: id.clone(),
        filename: filename.clone(),
        created_at,
    });
    state
        .command_tx
        .send(AudioCommand::Start { file_path })
        .map_err(|e| e.to_string())?;

    println!("Started recording: {}", id);
    Ok(RecordingInfo {
        id,
        filename,
        created_at,
    })
}

#[tauri::command]
pub async fn stop_recording(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Option<Entry>, String> {

    let (info, duration_seconds) = {
        let mut state = state.lock().unwrap();
        
        let (response_tx, response_rx) = std::sync::mpsc::channel();
        state
            .command_tx
            .send(AudioCommand::Stop { response_tx })
            .map_err(|e| e.to_string())?;
        
        let duration = response_rx.recv().ok().flatten();
        (state.current_recording.take(), duration)
    };

    if let Some(info) = info {
        let recordings_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("recordings");

        let file_path = recordings_dir.join(&info.filename);

        sqlx::query("INSERT INTO entries (id, filename, created_at, duration_seconds) VALUES (?, ?, ?, ?)")
            .bind(&info.id)
            .bind(&info.filename)
            .bind(info.created_at)
            .bind(duration_seconds)
            .execute(pool.inner())
            .await
            .map_err(|e| e.to_string())?;

        println!("Saved entry: {}", info.id);

        transcription::spawn_transcription_thread(file_path, info.id.clone(), app.clone());

        Ok(Some(Entry {
            id: info.id,
            filename: info.filename,
            created_at: info.created_at,
            duration_seconds: duration_seconds,
            transcript: None,
            title: None,
        }))
    } else {
        Ok(None)
    }
}
