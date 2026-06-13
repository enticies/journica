import { Entry } from "../../model/types";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
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
  audioPlayer: ReturnType<typeof useAudioPlayer>;
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
  audioPlayer,
}: Props) {
  const {
    handleDeleteEntry,
    progressMap,
  } = useRecordingsSidebar({ onDeleteEntry });

  return (
    <div className="h-full flex flex-col bg-light-50">
      <EntryList
        entries={entries}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        searchQuery={searchQuery}
        selectedEntryId={selectedEntryId}
        playingId={audioPlayer.playingId}
        progressMap={progressMap}
        onSelect={onSelectEntry}
        onPlay={(entry) => {
          void audioPlayer.handlePlay(entry);
        }}
        onDelete={(id) => {
          void handleDeleteEntry(id);
        }}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
