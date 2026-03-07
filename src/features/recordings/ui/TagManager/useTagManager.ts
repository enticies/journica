import { useState } from "react";
import { Tag } from "../../model/types";

interface UseTagManagerParams {
  selectedFilterTagIds: string[];
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onError: (message: string) => void;
}

export function useTagManager({
  selectedFilterTagIds,
  onSelectedFilterTagIdsChange,
  onCreateTag,
  onDeleteTag,
  onError,
}: UseTagManagerParams) {
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      return;
    }

    setIsCreatingTag(true);
    try {
      await onCreateTag(trimmed);
      setNewTagName("");
    } catch {
      onError("Failed to create tag.");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    setDeletingTagId(tagId);
    try {
      await onDeleteTag(tagId);
    } catch {
      onError("Failed to delete tag.");
    } finally {
      setDeletingTagId(null);
    }
  };

  const handleToggleFilterTag = (tagId: string) => {
    const exists = selectedFilterTagIds.includes(tagId);
    const nextTagIds = exists
      ? selectedFilterTagIds.filter((id) => id !== tagId)
      : [...selectedFilterTagIds, tagId];
    onSelectedFilterTagIdsChange(nextTagIds);
  };

  return {
    newTagName,
    isCreatingTag,
    deletingTagId,
    setNewTagName,
    handleCreateTag,
    handleDeleteTag,
    handleToggleFilterTag,
  };
}
