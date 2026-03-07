import { Tag } from "../../model/types";
import { useTagManager } from "./useTagManager";

interface Props {
  tags: Tag[];
  selectedFilterTagIds: string[];
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onError: (message: string) => void;
}

export function TagManager({
  tags,
  selectedFilterTagIds,
  onSelectedFilterTagIdsChange,
  onCreateTag,
  onDeleteTag,
  onError,
}: Props) {
  const {
    newTagName,
    isCreatingTag,
    deletingTagId,
    setNewTagName,
    handleCreateTag,
    handleDeleteTag,
    handleToggleFilterTag,
  } = useTagManager({
    selectedFilterTagIds,
    onSelectedFilterTagIdsChange,
    onCreateTag,
    onDeleteTag,
    onError,
  });

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          placeholder="Create tag"
          className="flex-1 px-3 py-2 text-sm border rounded bg-white"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreateTag();
            }
          }}
        />
        <button
          onClick={() => {
            void handleCreateTag();
          }}
          disabled={isCreatingTag || !newTagName.trim()}
          className="px-3 py-2 text-sm rounded bg-blue-500 text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1">
              <button
                onClick={() => handleToggleFilterTag(tag.id)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  selectedFilterTagIds.includes(tag.id)
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-200 border-gray-300 text-gray-800"
                }`}
                title="Toggle tag filter"
              >
                {tag.name}
              </button>
              <button
                onClick={() => {
                  void handleDeleteTag(tag.id);
                }}
                disabled={deletingTagId === tag.id}
                className="text-red-500 text-xs disabled:opacity-50"
                title="Delete tag"
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
