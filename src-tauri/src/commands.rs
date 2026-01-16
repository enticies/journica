use std::sync::Mutex;

use crate::{AppState, AudioCommand};


#[tauri::command]
pub fn start_recording(state: tauri::State<Mutex<AppState>>) {
    let state = state.lock().unwrap();
    state.command_tx.send(AudioCommand::Start).unwrap();
    println!("Start recording");
}

#[tauri::command]
pub fn stop_recording(state: tauri::State<Mutex<AppState>>) {
    let state = state.lock().unwrap();
    state.command_tx.send(AudioCommand::Stop).unwrap();
    println!("Stop recording");
}