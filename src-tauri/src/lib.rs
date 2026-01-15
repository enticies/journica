mod commands;
use std::sync::Mutex;

pub struct AppState {
    is_recording: bool,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(AppState {
            is_recording: false
        }))
        .invoke_handler(tauri::generate_handler![commands::start_recording, commands::stop_recording])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
