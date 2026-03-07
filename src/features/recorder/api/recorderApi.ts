import { invoke } from "@tauri-apps/api/core";

export async function startRecording(): Promise<void> {
  await invoke("start_recording");
}

export async function stopRecording(): Promise<void> {
  await invoke("stop_recording");
}
