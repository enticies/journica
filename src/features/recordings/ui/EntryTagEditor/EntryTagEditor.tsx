import { Entry, Tag } from "../../model/types";
import { useEntryTagEditor } from "./useEntryTagEditor";

interface Props {
  selectedEntry: Entry | null;
  tags: Tag[];
  onSetEntryTags: (entryId: string, tagIds: string[]) => Promise<void>;
  onError: (message: string) => void;
}

export function EntryTagEditor({ selectedEntry, tags, onSetEntryTags, onError }: Props) {
  const { updatingEntryId, handleToggleEntryTag, isTagSelected } = useEntryTagEditor({
    selectedEntry,
    onSetEntryTags,
    onError,
  });

  if (!selectedEntry || tags.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-2">Edit tags for selected recording</div>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => {
          const isSelected = isTagSelected(tag);
          return (
            <button
              key={tag.id}
              onClick={() => {
                void handleToggleEntryTag(selectedEntry, tag.id);
              }}
              disabled={updatingEntryId === selectedEntry.id}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                isSelected
                  ? "bg-green-600 border-green-600 text-white"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-100"
              } disabled:opacity-50`}
            >
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
