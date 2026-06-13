use sqlx::SqlitePool;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use super::audio_engine::{write_manifest, AudioCommand, RecordingManifest};
use super::types::RecordingInfo;
use crate::features::recordings::commands::{ensure_today_folder, Entry};
use crate::features::transcription;
use crate::shared::paths;
use crate::AppState;

fn timestamp_parts(secs: i64) -> (i32, u32, u32, u64, u64, u64) {
    let secs_u = secs as u64;
    let days_since_epoch = secs_u / 86400;
    let time_of_day = secs_u % 86400;

    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let mut year: i32 = 1970;
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

    let mut month: u32 = 0;
    for (i, &days) in days_in_months.iter().enumerate() {
        if remaining_days < days {
            month = (i + 1) as u32;
            break;
        }
        remaining_days -= days;
    }
    let day = (remaining_days + 1) as u32;

    (year, month, day, hours, minutes, seconds)
}

fn storage_path_from_timestamp(id: &str, secs: i64) -> String {
    let (year, month, day, hours, minutes, seconds) = timestamp_parts(secs);
    format!(
        "{:04}/{:02}/{:02}/{}_{:02}-{:02}-{:02}.wav",
        year, month, day, id, hours, minutes, seconds
    )
}

fn display_name_from_timestamp(secs: i64) -> String {
    let (year, month, day, hours, minutes, seconds) = timestamp_parts(secs);
    format!(
        "{:04}-{:02}-{:02}_{:02}-{:02}-{:02}",
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

    let storage_path = storage_path_from_timestamp(&id, created_at);
    let display_name = display_name_from_timestamp(created_at);

    let recordings_dir = paths::recordings_dir(&app)?;
    let file_path = recordings_dir.join(&storage_path);
    let session_dir = recordings_dir.join("in-progress").join(&id);

    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let manifest = RecordingManifest {
        id: id.clone(),
        storage_path: storage_path.clone(),
        display_name: display_name.clone(),
        created_at,
        sample_rate: 0,
        channels: 0,
        chunks: Vec::new(),
        total_frames: 0,
        status: "recording".to_string(),
    };
    write_manifest(&session_dir, &manifest)?;

    let mut state = state.lock().unwrap();
    state.current_recording = Some(RecordingInfo {
        id: id.clone(),
        storage_path: storage_path.clone(),
        display_name: display_name.clone(),
        created_at,
    });
    state
        .command_tx
        .send(AudioCommand::Start {
            session_dir,
            final_file_path: file_path,
            manifest,
        })
        .map_err(|e| e.to_string())?;

    println!("Started recording: {}", id);
    Ok(RecordingInfo {
        id,
        storage_path,
        display_name,
        created_at,
    })
}

#[tauri::command]
pub fn pause_recording(state: tauri::State<Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().unwrap();

    if state.current_recording.is_none() {
        return Err("No active recording to pause.".to_string());
    }

    state
        .command_tx
        .send(AudioCommand::Pause)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn resume_recording(state: tauri::State<Mutex<AppState>>) -> Result<(), String> {
    let state = state.lock().unwrap();

    if state.current_recording.is_none() {
        return Err("No active recording to resume.".to_string());
    }

    state
        .command_tx
        .send(AudioCommand::Resume)
        .map_err(|e| e.to_string())
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

        let duration = response_rx
            .recv()
            .map_err(|e| e.to_string())??
            .duration_seconds;
        (state.current_recording.take(), duration)
    };

    if let Some(info) = info {
        let recordings_dir = paths::recordings_dir(&app)?;
        let file_path = recordings_dir.join(&info.storage_path);

        let folder_id = ensure_today_folder(info.created_at, pool.inner()).await?;

        sqlx::query(
            "INSERT INTO entries (id, folder_id, storage_path, display_name, created_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&info.id)
        .bind(&folder_id)
        .bind(&info.storage_path)
        .bind(&info.display_name)
        .bind(info.created_at)
        .bind(duration_seconds)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;

        println!("Saved entry: {}", info.id);

        transcription::spawn_transcription_thread(file_path, info.id.clone(), app.clone());

        let session_dir = recordings_dir.join("in-progress").join(&info.id);
        std::fs::remove_dir_all(session_dir).ok();

        Ok(Some(Entry {
            id: info.id,
            folder_id,
            storage_path: info.storage_path,
            display_name: info.display_name,
            created_at: info.created_at,
            duration_seconds,
            transcript: None,
            title: None,
        }))
    } else {
        Ok(None)
    }
}
