import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

export function useRecording(onStop?: () => void) {
  const [isRecording, setIsRecording] = useState(false);

  const toggleRecording = async () => {
    try {
      if (!isRecording) {
        await invoke("start_recording");
        console.log("Started recording");
      } else {
        await invoke("stop_recording");
        console.log("Stopped recording");
        onStop?.();
      }
      setIsRecording(!isRecording);
    } catch (err) {
      console.error(err);
      alert(err);
    }
  };

  return { isRecording, toggleRecording };
}
