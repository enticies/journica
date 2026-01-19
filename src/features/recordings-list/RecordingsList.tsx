import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { useRef, useState } from "react";
import { Entry } from "./useEntries";

interface Props {
  entries: Entry[];
  onDelete: (id: string) => void;
}

export function RecordingsList({ entries, onDelete }: Props) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handlePlay = async (entry: Entry) => {
    if (playingId === entry.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      return;
    }

    try {
      const path = await invoke<string>("get_recording_path", { filename: entry.filename });

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const fileData = await readFile(path);

      const arrayBuffer = fileData instanceof Uint8Array
        ? fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
        : new TextEncoder().encode(String(fileData)).buffer;

      const blob = new Blob([arrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        setPlayingId(entry.id);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      alert(`Failed to play audio: ${error}`);
    }
  };

  const handleEnded = () => {
    setPlayingId(null);

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

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
                  {new Date(entry.created_at * 1000).toLocaleString()}
                </div>
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
