import { Entry, Tag } from "../../model/types";
import { EntryList } from "../EntryList";
import { EntryTagEditor } from "../EntryTagEditor";
import { RecordingsSearch } from "../RecordingsSearch";
import { TagManager } from "../TagManager";
import { useRecordingsSidebar } from "./useRecordingsSidebar";

interface Props {
  entries: Entry[];
  totalEntries: number;
  tags: Tag[];
  selectedEntry: Entry | null;
  selectedEntryId: string | null;
  searchQuery: string;
  selectedFilterTagIds: string[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onDeleteEntry: (id: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
  onSelectEntry: (id: string) => void;
  onSearchQueryChange: (value: string) => void;
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
  onLoadMore: () => void;
}

export function RecordingsSidebar({
  entries,
  totalEntries,
  tags,
  selectedEntry,
  selectedEntryId,
  searchQuery,
  selectedFilterTagIds,
  loading,
  loadingMore,
  hasMore,
  onDeleteEntry,
  onCreateTag,
  onDeleteTag,
  onSetEntryTags,
  onSelectEntry,
  onSearchQueryChange,
  onSelectedFilterTagIdsChange,
  onLoadMore,
}: Props) {
  const {
    errorMessage,
    setErrorMessage,
    clearError,
    playingId,
    audioRef,
    handlePlay,
    handleEnded,
    handleDeleteEntry,
    progressMap,
  } = useRecordingsSidebar({ onDeleteEntry });

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-lg font-bold p-4 border-b">Recordings ({entries.length}/{totalEntries})</h2>
      <div className="p-3 border-b bg-gray-50">
        <RecordingsSearch
          value={searchQuery}
          onChange={(value) => {
            clearError();
            onSearchQueryChange(value);
          }}
        />
        {errorMessage && <p className="mt-2 text-xs text-red-600">{errorMessage}</p>}
        <TagManager
          tags={tags}
          selectedFilterTagIds={selectedFilterTagIds}
          onSelectedFilterTagIdsChange={onSelectedFilterTagIdsChange}
          onCreateTag={onCreateTag}
          onDeleteTag={onDeleteTag}
          onError={setErrorMessage}
        />
        <EntryTagEditor
          selectedEntry={selectedEntry}
          tags={tags}
          onSetEntryTags={onSetEntryTags}
          onError={setErrorMessage}
        />
      </div>
      <audio ref={audioRef} onEnded={handleEnded} className="hidden" />
      <EntryList
        entries={entries}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        searchQuery={searchQuery}
        selectedEntryId={selectedEntryId}
        playingId={playingId}
        progressMap={progressMap}
        onSelect={onSelectEntry}
        onPlay={(entry) => {
          void handlePlay(entry);
        }}
        onDelete={(id) => {
          void handleDeleteEntry(id);
        }}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
