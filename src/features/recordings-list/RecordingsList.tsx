import { Entry } from "./useEntries";
import { useTranscriptionProgress } from "../transcription/useTranscriptionProgress";
import { useAudioPlayer } from "./useAudioPlayer";
import { formatDuration } from "../../shared/utils/formatDuration";

interface Props {
  entries: Entry[];
  onDelete: (id: string) => void;
}

export function RecordingsList({ entries, onDelete }: Props) {
  const { playingId, audioRef, handlePlay, handleEnded } = useAudioPlayer();
  const progressMap = useTranscriptionProgress();

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-bold p-4 border-b">Recordings ({entries.length})</h2>
      <audio ref={audioRef} onEnded={handleEnded} className="hidden" />
      <ul className="flex-1 overflow-y-auto p-2 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="p-2 bg-gray-100 rounded">
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm truncate">
                  {entry.title || entry.filename.replace(".wav", "")}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(entry.created_at * 1000).toLocaleString()}<br/>
                  {entry.duration_seconds !== null && (
                    <span className="ml-2">{formatDuration(entry.duration_seconds)}</span>
                  )}
                </div>
                {progressMap[entry.id] !== undefined && (
                  <span>Transcribing: {progressMap[entry.id]}%</span>
                )}

              </div>
              <div className="flex gap-1 ml-2">
                <button
                  onClick={() => handlePlay(entry)}
                  className="px-2 py-1 text-blue-500 hover:bg-blue-100 rounded"
                >
                  {playingId === entry.id ? "⏹" : "▶"}
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="px-2 py-1 text-red-500 hover:bg-red-100 rounded"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
