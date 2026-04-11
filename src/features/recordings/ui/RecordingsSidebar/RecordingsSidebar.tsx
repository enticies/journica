import { Entry, Tag } from "../../model/types";
import { Typography } from "../../../../shared/ui/Typography";
import { EntryList } from "../EntryList";
import { EntryTagEditor } from "../EntryTagEditor";
import { RecordingsSearch } from "../RecordingsSearch";
import { useRecordingsSidebar } from "./useRecordingsSidebar";

interface Props {
  entries: Entry[];
  totalEntries: number;
  tags: Tag[];
  selectedEntry: Entry | null;
  selectedEntryId: string | null;
  searchQuery: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onDeleteEntry: (id: string) => Promise<void>;
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
  onSelectEntry: (id: string) => void;
  onSearchQueryChange: (value: string) => void;
  onLoadMore: () => void;
}

export function RecordingsSidebar({
  entries,
  totalEntries,
  tags,
  selectedEntry,
  selectedEntryId,
  searchQuery,
  loading,
  loadingMore,
  hasMore,
  onDeleteEntry,
  onSetEntryTags,
  onSelectEntry,
  onSearchQueryChange,
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
      <Typography variant="h4" as="h2" className="p-4 border-b">
        Recordings ({entries.length}/{totalEntries})
      </Typography>
      <div className="p-3 border-b bg-light-50">
        <RecordingsSearch
          value={searchQuery}
          onChange={(value) => {
            clearError();
            onSearchQueryChange(value);
          }}
        />
        {errorMessage && (
          <Typography variant="caption" as="p" className="mt-2 text-red-600">
            {errorMessage}
          </Typography>
        )}
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
