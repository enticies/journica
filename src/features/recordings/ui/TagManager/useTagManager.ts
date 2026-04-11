interface UseTagManagerParams {
  selectedFilterTagIds: string[];
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
}

export function useTagManager({ selectedFilterTagIds, onSelectedFilterTagIdsChange }: UseTagManagerParams) {
  const handleToggleFilterTag = (tagId: string) => {
    const exists = selectedFilterTagIds.includes(tagId);
    const nextTagIds = exists
      ? selectedFilterTagIds.filter((id) => id !== tagId)
      : [...selectedFilterTagIds, tagId];
    onSelectedFilterTagIdsChange(nextTagIds);
  };

  return {
    handleToggleFilterTag,
  };
}
