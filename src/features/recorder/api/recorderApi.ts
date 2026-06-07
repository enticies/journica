import { invoke } from "@tauri-apps/api/core";

export async function startRecording(): Promise<void> {
  await invoke("start_recording");
}

export async function pauseRecording(): Promise<void> {
  await invoke("pause_recording");
}

export async function resumeRecording(): Promise<void> {
  await invoke("resume_recording");
}

export async function stopRecording(): Promise<void> {
  await invoke("stop_recording");
}
