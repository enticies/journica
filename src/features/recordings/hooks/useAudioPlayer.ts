import { readFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { getRecordingPath } from "../api/recordingsApi";
import { Entry } from "../model/types";

export function useAudioPlayer(onError?: (message: string) => void) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
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
    setActiveId(null);
    setPlayingId(null);
    setCurrentTime(0);
    clearObjectUrl();
  };

  const handlePlay = async (entry: Entry) => {
    if (activeId === entry.id && audioRef.current) {
      if (audioRef.current.paused) {
        await audioRef.current.play();
        setPlayingId(entry.id);
        return;
      }

      audioRef.current.pause();
      setPlayingId(null);
      return;
    }

    try {
      const path = await getRecordingPath(entry.storage_path);

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
        setCurrentTime(0);
        setDuration(entry.duration_seconds ?? 0);
        await audioRef.current.play();
        setActiveId(entry.id);
        setPlayingId(entry.id);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      onError?.("Failed to play audio.");
      stopPlayback();
    }
  };

  const handleEnded = () => {
    setActiveId(null);
    setPlayingId(null);
    setCurrentTime(0);
    clearObjectUrl();
  };

  const handleLoadedMetadata = () => {
    setDuration(audioRef.current?.duration || 0);
  };

  const handleTimeUpdate = () => {
    setCurrentTime(audioRef.current?.currentTime ?? 0);
  };

  useEffect(() => {
    return () => {
      clearObjectUrl();
    };
  }, []);

  return {
    playingId,
    activeId,
    currentTime,
    duration,
    audioRef,
    handlePlay,
    handleEnded,
    handleLoadedMetadata,
    handleTimeUpdate,
    stopPlayback,
  };
}
