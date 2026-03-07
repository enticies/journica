import { Entry } from "../../model/types";
import { EntryListItem } from "../EntryListItem";
import { useEntryList } from "./useEntryList";

interface Props {
  entries: Entry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  searchQuery: string;
  selectedEntryId: string | null;
  playingId: string | null;
  progressMap: Record<string, number>;
  onSelect: (id: string) => void;
  onPlay: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}

export function EntryList({
  entries,
  loading,
  loadingMore,
  hasMore,
  searchQuery,
  selectedEntryId,
  playingId,
  progressMap,
  onSelect,
  onPlay,
  onDelete,
  onLoadMore,
}: Props) {
  const { listRef, sentinelRef } = useEntryList({ hasMore, loading, loadingMore, onLoadMore });

  return (
    <ul ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-2">
      {loading && entries.length === 0 && <li className="p-2 text-sm text-gray-500">Loading recordings...</li>}
      {!loading && entries.length === 0 && (
        <li className="p-2 text-sm text-gray-500">
          {searchQuery.trim() ? "No matching recordings found." : "No recordings yet."}
        </li>
      )}
      {entries.map((entry) => (
        <EntryListItem
          key={entry.id}
          entry={entry}
          selected={selectedEntryId === entry.id}
          playing={playingId === entry.id}
          progress={progressMap[entry.id]}
          onSelect={onSelect}
          onPlay={onPlay}
          onDelete={onDelete}
        />
      ))}
      {loadingMore && <li className="p-2 text-sm text-gray-500">Loading more...</li>}
      {hasMore && !loading && <li ref={sentinelRef} className="h-1" />}
    </ul>
  );
}
