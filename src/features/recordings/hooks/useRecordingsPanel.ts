import { useMemo } from "react";
import { useEntriesQuery } from "./useEntriesQuery";
import { useEntrySelection } from "./useEntrySelection";

export function useRecordingsPanel() {
  const {
    entries,
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
  } = useEntriesQuery();

  const visibleEntries = useMemo(() => {
    if (selectedFilterTagIds.length === 0) {
      return entries;
    }

    return entries.filter((entry) => {
      const entryTagIds = new Set(entry.tags.map((tag) => tag.id));
      return selectedFilterTagIds.every((tagId) => entryTagIds.has(tagId));
    });
  }, [entries, selectedFilterTagIds]);

  const { selectedEntryId, setSelectedEntryId, selectedEntry } = useEntrySelection(visibleEntries);

  const scriptMessage = useMemo(() => {
    if (!selectedEntry) {
      if (searchQuery.trim()) {
        return "No matching recordings found for this search.";
      }

      return "Select a recording from the side panel to view its script.";
    }

    if (!selectedEntry.transcript) {
      return "No script available yet for this recording.";
    }

    return null;
  }, [searchQuery, selectedEntry]);

  return {
    entries: visibleEntries,
    totalEntries: entries.length,
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
  };
}
