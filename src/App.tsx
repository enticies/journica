import { useState } from "react";
import { useRecordingSession } from "./features/recorder";
import { NavigationSidebar, useFolderTree } from "./features/navigation";
import { RecordingsSidebar, ScriptPanel, useRecordingsPanel } from "./features/recordings";

function App() {
  const [folderSearchQuery, setFolderSearchQuery] = useState("");

  const {
    journalNodes,
    expandedIds,
    toggleExpanded,
    selectedFolderId,
    setSelectedFolderId,
    reloadFolders,
  } = useFolderTree();

  const { isRecording, toggleRecording } = useRecordingSession(() => {
    void reloadFolders();
  });

  const {
    entries,
    totalEntries,
    tags,
    loading,
    loadingMore,
    hasMore,
    searchQuery,
    setSearchQuery,
    selectedFilterTagIds,
    setSelectedFilterTagIds,
    loadMore,
    deleteEntry,
    createTag,
    deleteTag,
    setEntryTags,
    selectedEntry,
    selectedEntryId,
    setSelectedEntryId,
    scriptMessage,
  } = useRecordingsPanel(selectedFolderId);

  const handleNewEntry = () => {
    void toggleRecording();
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen w-full flex-col md:flex-row">
        <aside className="md:min-w-56 md:basis-1/5 md:max-w-sm">
          <NavigationSidebar
            searchQuery={folderSearchQuery}
            onSearchQueryChange={setFolderSearchQuery}
            isRecording={isRecording}
            onNewEntry={handleNewEntry}
            journalNodes={journalNodes}
            expandedIds={expandedIds}
            selectedFolderId={selectedFolderId}
            onToggleExpanded={toggleExpanded}
            onSelectFolder={setSelectedFolderId}
          />
        </aside>

        <div className="min-h-40 border-r md:min-w-72 md:basis-1/4">
          <RecordingsSidebar
            entries={entries}
            totalEntries={totalEntries}
            tags={tags}
            selectedEntry={selectedEntry}
            selectedEntryId={selectedEntryId}
            searchQuery={searchQuery}
            selectedFilterTagIds={selectedFilterTagIds}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onDeleteEntry={async (id) => {
              await deleteEntry(id);
              await reloadFolders();
            }}
            onCreateTag={createTag}
            onDeleteTag={deleteTag}
            onSetEntryTags={setEntryTags}
            onSelectEntry={setSelectedEntryId}
            onSearchQueryChange={setSearchQuery}
            onSelectedFilterTagIdsChange={setSelectedFilterTagIds}
            onLoadMore={() => {
              void loadMore();
            }}
          />
        </div>

        <main className="min-h-40 flex flex-1 min-w-0">
          <ScriptPanel selectedEntry={selectedEntry} searchQuery={searchQuery} scriptMessage={scriptMessage} />
        </main>
      </div>
    </div>
  );
}

export default App;
