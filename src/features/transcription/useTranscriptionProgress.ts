import { listen } from "@tauri-apps/api/event";
import { useState, useEffect } from "react";
interface TranscriptionProgress {
    entry_id: string;
    progress: number;
}
export function useTranscriptionProgress() {
    const [progressMap, setProgressMap] = useState<Record<string, number>>({});

    useEffect(() => {
        const unlistenProgress = listen<TranscriptionProgress>(
            "transcription-progress",
            (event) => {
                setProgressMap(prev => ({
                    ...prev,
                    [event.payload.entry_id]: event.payload.progress
                }));
            }
        );
        const unlistenComplete = listen<{ entry_id: string }>(
            "transcription-complete",
            (event) => {
                setProgressMap(prev => {
                    const { [event.payload.entry_id]: _, ...rest } = prev;
                    return rest;
                });
            }
        );
        const unlistenFailed = listen<{ entry_id: string }>(
            "transcription-failed",
            (event) => {
                setProgressMap(prev => {
                    const { [event.payload.entry_id]: _, ...rest } = prev;
                    return rest;
                });
            }
        );
        return () => {
            unlistenProgress.then(fn => fn());
            unlistenComplete.then(fn => fn());
            unlistenFailed.then(fn => fn());
        };
    }, []);
    return progressMap;
}
