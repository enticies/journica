mod features;
mod shared;

use std::sync::{
    mpsc::{self, Sender},
    Mutex,
};
use tauri::Manager;

use crate::features::recorder::audio_engine::AudioCommand;
use crate::features::recorder::types::RecordingInfo;

pub struct AppState {
    pub command_tx: Sender<AudioCommand>,
    pub current_recording: Option<RecordingInfo>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    features::recorder::spawn_audio_thread(rx);

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
                let pool = shared::db::init(&handle)
                    .await
                    .expect("Failed to initialize database");
                handle.manage(pool);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            features::recorder::commands::start_recording,
            features::recorder::commands::pause_recording,
            features::recorder::commands::resume_recording,
            features::recorder::commands::stop_recording,
            features::recordings::commands::get_entries,
            features::recordings::commands::query_entries,
            features::recordings::commands::get_recording_path,
            features::recordings::commands::delete_entry,
            features::recordings::commands::list_tags,
            features::recordings::commands::create_tag,
            features::recordings::commands::delete_tag,
            features::recordings::commands::set_entry_tags,
            features::recordings::commands::get_entry_tags,
            features::recordings::commands::list_folders,
            features::recordings::commands::create_folder,
            features::recordings::commands::rename_folder,
            features::recordings::commands::move_folder,
            features::recordings::commands::delete_folder,
            features::recordings::commands::move_entry,
            features::recordings::commands::rename_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
