mod audio;
mod commands;
mod db;
mod transcription;

use std::sync::{Mutex, mpsc::{self, Sender}};
use tauri::Manager;

use crate::audio::AudioCommand;
use crate::commands::RecordingInfo;

pub struct AppState {
    pub command_tx: Sender<AudioCommand>,
    pub current_recording: Option<RecordingInfo>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    audio::spawn_audio_thread(rx);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(AppState {
            command_tx: tx,
            current_recording: None,
        }))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async {
                let pool = db::init(&handle).await.expect("Failed to initialize database");
                handle.manage(pool);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_recording,
            commands::stop_recording,
            commands::get_entries,
            commands::get_recording_path,
            commands::delete_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
