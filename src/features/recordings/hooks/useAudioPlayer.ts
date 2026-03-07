import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { getRecordingPath } from "../api/recordingsApi";
import { Entry } from "../model/types";

export function useAudioPlayer(onError?: (message: string) => void) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const clearObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const stopPlayback = () => {
    audioRef.current?.pause();
    setPlayingId(null);
    clearObjectUrl();
  };

  const handlePlay = async (entry: Entry) => {
    if (playingId === entry.id) {
      stopPlayback();
      return;
    }

    try {
      const path = await getRecordingPath(entry.filename);

      clearObjectUrl();

      const fileData = await readFile(path);
      const arrayBuffer =
        fileData instanceof Uint8Array
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
      onError?.("Failed to play audio.");
      stopPlayback();
    }
  };

  const handleEnded = () => {
    setPlayingId(null);
    clearObjectUrl();
  };

  useEffect(() => {
    return () => {
      clearObjectUrl();
    };
  }, []);

  return {
    playingId,
    audioRef,
    handlePlay,
    handleEnded,
    stopPlayback,
  };
}
