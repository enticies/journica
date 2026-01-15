use std::sync::Mutex;

use crate::AppState;


#[tauri::command]
pub fn start_recording(state: tauri::State<Mutex<AppState>>) {
    let mut state = state.lock().unwrap();
    state.is_recording = true;
    println!("Start recording");
}

#[tauri::command]
pub fn stop_recording(state: tauri::State<Mutex<AppState>>) {
    let mut state = state.lock().unwrap();
    state.is_recording = false;
    println!("Stop recording");
}