import { useRecording } from "./useRecording";

interface Props {
  onStop?: () => void;
}

export function RecordingControl({ onStop }: Props) {
  const { isRecording, toggleRecording } = useRecording(onStop);

  return (
    <main className="flex-1 p-8 flex flex-col items-center justify-center">
      <button
        className={`px-8 py-4 text-xl rounded-full transition-colors ${
          isRecording
            ? "bg-red-500 hover:bg-red-600 text-white"
            : "bg-blue-500 hover:bg-blue-600 text-white"
        }`}
        onClick={toggleRecording}
      >
        {isRecording ? "⏹ Stop" : "⏺ Record"}
      </button>
      {isRecording && (
        <div className="mt-4 text-red-500 animate-pulse">Recording...</div>
      )}
    </main>
  );
}
