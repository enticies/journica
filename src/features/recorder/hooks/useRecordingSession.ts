import { useEffect, useState } from "react";
import { pauseRecording, resumeRecording, startRecording, stopRecording } from "../api/recorderApi";

export function useRecordingSession(onStop?: () => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleRecording = async () => {
    setErrorMessage(null);
    try {
      if (!isRecording) {
        await startRecording();
        setDurationSeconds(0);
        setIsPaused(false);
        setIsRecording(true);
        return;
      }

      if (isPaused) {
        await resumeRecording();
        setIsPaused(false);
      } else {
        await pauseRecording();
        setIsPaused(true);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Recording action failed.");
    }
  };

  const stopCurrentRecording = async () => {
    setErrorMessage(null);
    try {
      await stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setDurationSeconds(0);
      onStop?.();
    } catch (error) {
      console.error(error);
      setErrorMessage("Recording action failed.");
    }
  };

  useEffect(() => {
    if (!isRecording || isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setDurationSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPaused, isRecording]);

  return { isRecording, isPaused, durationSeconds, errorMessage, toggleRecording, stopCurrentRecording };
}
