import { useState } from "react";
import { startRecording, stopRecording } from "../api/recorderApi";

export function useRecordingSession(onStop?: () => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleRecording = async () => {
    setErrorMessage(null);
    try {
      if (!isRecording) {
        await startRecording();
      } else {
        await stopRecording();
        onStop?.();
      }
      setIsRecording((previous) => !previous);
    } catch (error) {
      console.error(error);
      setErrorMessage("Recording action failed.");
    }
  };

  return { isRecording, errorMessage, toggleRecording };
}
