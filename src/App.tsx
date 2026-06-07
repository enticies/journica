import { NavigationSidebar } from "./features/navigation";
import { RecordingsSidebar, ScriptPanel } from "./features/recordings";
import { useAppController } from "./hooks/useAppController";

function App() {
  const {
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
  } = useAppController();

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="md:min-w-56 md:basis-1/5 md:max-w-sm">
          <NavigationSidebar
            searchQuery={folderSearchQuery}
            onSearchQueryChange={setFolderSearchQuery}
            isRecording={isRecording}
            isRecordingPaused={isRecordingPaused}
            recordingDurationSeconds={recordingDurationSeconds}
            onNewEntry={onNewEntry}
            onStopEntry={onStopEntry}
            journalNodes={journalNodes}
            userNodes={userNodes}
            expandedIds={expandedIds}
            selectedFolderId={selectedFolderId}
            tags={recordingsPanel.tags}
            selectedFilterTagIds={recordingsPanel.selectedFilterTagIds}
            onToggleExpanded={toggleExpanded}
            onSelectFolder={setSelectedFolderId}
            onSelectedFilterTagIdsChange={recordingsPanel.setSelectedFilterTagIds}
            onCreateFolder={onCreateFolder}
            onCreateTag={recordingsPanel.createTag}
          />
        </aside>

        <div className="min-h-40 border-r border-light-base bg-light-50 md:min-w-72 md:basis-1/4">
          <RecordingsSidebar
            entries={recordingsPanel.entries}
            selectedEntryId={recordingsPanel.selectedEntryId}
            searchQuery={recordingsPanel.searchQuery}
            loading={recordingsPanel.loading}
            loadingMore={recordingsPanel.loadingMore}
            hasMore={recordingsPanel.hasMore}
            onDeleteEntry={onDeleteEntry}
            onSelectEntry={recordingsPanel.setSelectedEntryId}
            onLoadMore={onLoadMore}
          />
        </div>

        <main className="min-h-40 flex flex-1 min-w-0">
          <ScriptPanel
            selectedEntry={recordingsPanel.selectedEntry}
            tags={recordingsPanel.tags}
            searchQuery={recordingsPanel.searchQuery}
            scriptMessage={recordingsPanel.scriptMessage}
            onSetEntryTags={recordingsPanel.setEntryTags}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
