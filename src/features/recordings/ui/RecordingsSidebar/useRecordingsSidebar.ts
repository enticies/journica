import { useState } from "react";
import { useTranscriptionProgress } from "../../../transcription/useTranscriptionProgress";

interface UseRecordingsSidebarParams {
  onDeleteEntry: (id: string) => Promise<void>;
}

export function useRecordingsSidebar({ onDeleteEntry }: UseRecordingsSidebarParams) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    handleDeleteEntry,
    progressMap,
  };
}
