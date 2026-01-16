mod commands;
mod audio;
use std::{sync::{Mutex, mpsc::{self, Sender}}, thread};

use crate::audio::AudioCommand;

pub struct AppState {
    command_tx: Sender<AudioCommand>
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel::<AudioCommand>();

    audio::spawn_audio_thread(rx);

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppState {
            command_tx: tx
        }))
        .invoke_handler(tauri::generate_handler![commands::start_recording, commands::stop_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
