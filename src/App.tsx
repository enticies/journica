import { NavigationSidebar } from "./features/navigation";
import { RecordingsSidebar, ScriptPanel } from "./features/recordings";
import { ModelDownloadProgress, useModelSetup } from "./features/transcription/useModelSetup";
import { useAppController } from "./hooks/useAppController";

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ModelSetupScreen({ progress, errorMessage, onRetry }: {
  progress: ModelDownloadProgress | null;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const percentage = progress?.progress ?? 0;
  const downloaded = progress ? formatBytes(progress.downloaded_bytes) : "0.0 MB";
  const total = progress?.total_bytes ? formatBytes(progress.total_bytes) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-light-50 px-6 text-dark-90">
      <div className="w-full max-w-md rounded-2xl border border-light-base bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-dark-30">First launch setup</p>
        <h1 className="mt-3 text-2xl font-semibold">Installing transcription model</h1>
        <p className="mt-3 text-sm leading-6 text-dark-60">
          Journica is downloading the speech model once so future recordings can be transcribed locally.
        </p>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-light-80">
          <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${percentage}%` }} />
        </div>

        <div className="mt-3 flex items-center justify-between text-sm font-medium text-dark-60">
          <span>{progress?.progress !== null && progress?.progress !== undefined ? `${percentage}%` : "Downloading..."}</span>
          <span>{total ? `${downloaded} / ${total}` : downloaded}</span>
        </div>

        {errorMessage && (
          <div className="mt-5">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-full bg-dark-90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-dark-70"
            >
              Retry download
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MainApp() {
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
    <div className="h-screen overflow-hidden bg-white">
      <div className="flex h-full w-full flex-col overflow-hidden md:flex-row">
        <aside className="min-h-0 md:min-w-0 md:basis-[20%]">
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

        <div className="min-h-0 border-r border-light-base bg-light-50 md:min-w-0 md:basis-[20%]">
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

        <main className="flex min-h-0 min-w-0 overflow-hidden md:basis-[60%]">
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

function App() {
  const modelSetup = useModelSetup();

  if (!modelSetup.ready) {
    return (
      <ModelSetupScreen
        progress={modelSetup.progress}
        errorMessage={modelSetup.errorMessage}
        onRetry={modelSetup.retry}
      />
    );
  }

  return <MainApp />;
}

export default App;
