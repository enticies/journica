import { RecordingControl } from "./features/recorder";
import { RecordingsSidebar, ScriptPanel, useRecordingsPanel } from "./features/recordings";

function App() {
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
    loadEntries,
    loadMore,
    deleteEntry,
    createTag,
    deleteTag,
    setEntryTags,
    selectedEntryId,
    setSelectedEntryId,
    selectedEntry,
    scriptMessage,
  } = useRecordingsPanel();

  return (
    <div className="h-screen flex">
      <aside className="w-80 border-l bg-gray-50">
        <RecordingsSidebar
          entries={entries}
          totalEntries={totalEntries}
          tags={tags}
          selectedEntry={selectedEntry}
          onDeleteEntry={deleteEntry}
          onCreateTag={createTag}
          onDeleteTag={deleteTag}
          onSetEntryTags={setEntryTags}
          onSelectEntry={setSelectedEntryId}
          selectedEntryId={selectedEntryId}
          searchQuery={searchQuery}
          onSearchQueryChange={(value) => {
            setSearchQuery(value);
          }}
          selectedFilterTagIds={selectedFilterTagIds}
          onSelectedFilterTagIdsChange={(tagIds) => {
            setSelectedFilterTagIds(tagIds);
          }}
          onLoadMore={loadMore}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
        />
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        <div className="border-b p-4 bg-white">
          <RecordingControl onStop={loadEntries} />
        </div>
        <ScriptPanel
          selectedEntry={selectedEntry}
          searchQuery={searchQuery}
          scriptMessage={scriptMessage}
        />
      </main>

    </div>
  );
}

export default App;
