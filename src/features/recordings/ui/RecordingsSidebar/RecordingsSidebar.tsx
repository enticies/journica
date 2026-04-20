import { Entry } from "../../model/types";
import { EntryList } from "../EntryList";
import { useRecordingsSidebar } from "./useRecordingsSidebar";

interface Props {
  entries: Entry[];
  selectedEntryId: string | null;
  searchQuery: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onDeleteEntry: (id: string) => Promise<void>;
  onSelectEntry: (id: string) => void;
  onLoadMore: () => void;
}

export function RecordingsSidebar({
  entries,
  selectedEntryId,
  searchQuery,
  loading,
  loadingMore,
  hasMore,
  onDeleteEntry,
  onSelectEntry,
  onLoadMore,
}: Props) {
  const {
    playingId,
    audioRef,
    handlePlay,
    handleEnded,
    handleDeleteEntry,
    progressMap,
  } = useRecordingsSidebar({ onDeleteEntry });

  return (
    <div className="h-full flex flex-col bg-light-50">
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
