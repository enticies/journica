import { useState } from "react";
import { useTranscriptionProgress } from "../../../transcription/useTranscriptionProgress";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";

interface UseRecordingsSidebarParams {
  onDeleteEntry: (id: string) => Promise<void>;
}

export function useRecordingsSidebar({ onDeleteEntry }: UseRecordingsSidebarParams) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { playingId, audioRef, handlePlay, handleEnded } = useAudioPlayer(setErrorMessage);
  const progressMap = useTranscriptionProgress();

  const clearError = () => {
    setErrorMessage(null);
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await onDeleteEntry(id);
    } catch {
      setErrorMessage("Failed to delete recording.");
    }
  };

  return {
    errorMessage,
    setErrorMessage,
    clearError,
    playingId,
    audioRef,
    handlePlay,
    handleEnded,
    handleDeleteEntry,
    progressMap,
  };
}
