import { useRecordingSession } from "../../hooks/useRecordingSession";

interface UseRecordingControlParams {
  onStop?: () => void;
}

export function useRecordingControl({ onStop }: UseRecordingControlParams) {
  const { isRecording, errorMessage, toggleRecording } = useRecordingSession(onStop);

  const handleToggleRecording = () => {
    void toggleRecording();
  };

  return {
    isRecording,
    errorMessage,
    handleToggleRecording,
  };
}
