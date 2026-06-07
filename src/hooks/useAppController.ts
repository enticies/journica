import { useCallback, useState } from "react";
import { useFolderTree } from "../features/navigation";
import { createFolder } from "../features/recordings/api/recordingsApi";
import { useRecordingsPanel } from "../features/recordings";
import { useRecordingSession } from "../features/recorder";

export function useAppController() {
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  const {
    journalNodes,
    userNodes,
    expandedIds,
    toggleExpanded,
    selectedFolderId,
    setSelectedFolderId,
    reloadFolders,
  } = useFolderTree();

  const {
    isRecording,
    isPaused: isRecordingPaused,
    durationSeconds: recordingDurationSeconds,
    toggleRecording,
    stopCurrentRecording,
  } = useRecordingSession(() => {
    void reloadFolders();
  });

  const recordingsPanel = useRecordingsPanel(selectedFolderId);

  const onNewEntry = useCallback(() => {
    void toggleRecording();
  }, [toggleRecording]);

  const onStopEntry = useCallback(() => {
    if (isRecording) {
      void stopCurrentRecording();
    }
  }, [isRecording, stopCurrentRecording]);

  const onCreateFolder = useCallback(
    async (name: string) => {
      const folder = await createFolder("root", name);
      await reloadFolders();
      setSelectedFolderId(folder.id);
    },
    [reloadFolders, setSelectedFolderId],
  );

  const onDeleteEntry = useCallback(
    async (id: string) => {
      await recordingsPanel.deleteEntry(id);
      await reloadFolders();
    },
    [recordingsPanel, reloadFolders],
  );

  const onLoadMore = useCallback(() => {
    void recordingsPanel.loadMore();
  }, [recordingsPanel]);

  return {
    folderSearchQuery,
    setFolderSearchQuery,
    journalNodes,
    userNodes,
    expandedIds,
    toggleExpanded,
    selectedFolderId,
    setSelectedFolderId,
    isRecording,
    isRecordingPaused,
    recordingDurationSeconds,
    onNewEntry,
    onStopEntry,
    onCreateFolder,
    onDeleteEntry,
    onLoadMore,
    recordingsPanel,
  };
}
