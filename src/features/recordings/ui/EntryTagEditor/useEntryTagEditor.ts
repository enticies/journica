import { useState } from "react";
import { Entry, Tag } from "../../model/types";

interface UseEntryTagEditorParams {
  selectedEntry: Entry | null;
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
  onError: (message: string) => void;
}

export function useEntryTagEditor({
  selectedEntry,
  onSetEntryTags,
  onError,
}: UseEntryTagEditorParams) {
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);

  const handleToggleEntryTag = async (entry: Entry, tagId: string) => {
    const selectedTagIds = entry.tags.map((tag) => tag.id);
    const alreadySelected = selectedTagIds.includes(tagId);
    const nextTagIds = alreadySelected
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    setUpdatingEntryId(entry.id);
    try {
      await onSetEntryTags(entry.id, nextTagIds);
    } catch {
      onError("Failed to update tags for this recording.");
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const isTagSelected = (tag: Tag) =>
    Boolean(selectedEntry?.tags.some((entryTag) => entryTag.id === tag.id));

  return {
    updatingEntryId,
    handleToggleEntryTag,
    isTagSelected,
  };
}
