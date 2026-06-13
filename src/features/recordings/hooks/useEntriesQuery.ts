import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTag as createTagRequest,
  deleteEntry as deleteEntryRequest,
  deleteTag as deleteTagRequest,
  getEntryTags,
  listTags,
  queryEntries,
  setEntryTags as setEntryTagsRequest,
} from "../api/recordingsApi";
import { mapEntryTags, sortTagsByName } from "../model/entryMappers";
import { Entry, Tag } from "../model/types";

const PAGE_SIZE = 100;

export function useEntriesQuery(folderId?: string | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const requestIdRef = useRef(0);

  const loadTags = useCallback(async () => {
    try {
      const result = await listTags();
      setTags(sortTagsByName(result));
    } catch (error) {
      console.error("Failed to load tags:", error);
      setTags([]);
    }
  }, []);

  const runQuery = useCallback(
    async ({ offset, append }: { offset: number; append: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await queryEntries({
          query: debouncedQuery || null,
          limit: PAGE_SIZE,
          offset,
          folderId,
        });
        const entryIds = result.map((entry) => entry.id);
        let tagsByEntry = new Map<string, Tag[]>();
        if (entryIds.length > 0) {
          try {
            const tagRecords = await getEntryTags(entryIds);
            tagsByEntry = mapEntryTags(tagRecords);
          } catch (error) {
            console.error("Failed to load entry tags:", error);
          }
        }

        const hydratedEntries: Entry[] = result.map((entry) => ({
          ...entry,
          tags: tagsByEntry.get(entry.id) ?? [],
        }));

        if (requestId !== requestIdRef.current) {
          return;
        }

        setEntries((previous) => (append ? [...previous, ...hydratedEntries] : hydratedEntries));
        setHasMore(result.length === PAGE_SIZE);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedQuery, folderId],
  );

  const loadEntries = useCallback(async () => {
    await runQuery({ offset: 0, append: false });
  }, [runQuery]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) {
      return;
    }

    await runQuery({ offset: entries.length, append: true });
  }, [entries.length, hasMore, loading, loadingMore, runQuery]);

  const deleteEntry = useCallback(
    async (id: string) => {
      await deleteEntryRequest(id);
      await loadEntries();
    },
    [loadEntries],
  );

  const createTag = useCallback(async (name: string) => {
    const createdTag = await createTagRequest(name);
    setTags((previous) => {
      const withoutExisting = previous.filter((tag) => tag.id !== createdTag.id);
      return sortTagsByName([...withoutExisting, createdTag]);
    });
    return createdTag;
  }, []);

  const deleteTag = useCallback(async (tagId: string) => {
    await deleteTagRequest(tagId);
    setTags((previous) => previous.filter((tag) => tag.id !== tagId));
    setEntries((previous) =>
      previous.map((entry) => ({
        ...entry,
        tags: entry.tags.filter((tag) => tag.id !== tagId),
      })),
    );
  }, []);

  const setEntryTags = useCallback(
    async (entryId: string, tagIds: string[]) => {
      const uniqueTagIds = [...new Set(tagIds)];
      const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
      const nextTags = uniqueTagIds
        .map((tagId) => tagsById.get(tagId))
        .filter((tag): tag is Tag => Boolean(tag));

      setEntries((previous) =>
        previous.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                tags: sortTagsByName(nextTags),
              }
            : entry,
        ),
      );

      try {
        await setEntryTagsRequest({
          entryId,
          tagIds: uniqueTagIds,
        });
      } catch (error) {
        await loadEntries();
        throw error;
      }
    },
    [loadEntries, tags],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const unlisten = listen<{ entry_id: string }>("transcription-complete", () => {
      void loadEntries();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadEntries]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  return {
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
  };
}
