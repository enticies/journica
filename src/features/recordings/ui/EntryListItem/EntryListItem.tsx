import { Entry } from "../../model/types";
import { useEntryListItem } from "./useEntryListItem";

interface Props {
  entry: Entry;
  selected: boolean;
  playing: boolean;
  progress: number | undefined;
  onSelect: (id: string) => void;
  onPlay: (entry: Entry) => void;
  onDelete: (id: string) => void;
}

export function EntryListItem({
  entry,
  selected,
  playing,
  progress,
  onSelect,
  onPlay,
  onDelete,
}: Props) {
  const { displayTitle, createdAtLabel, durationLabel } = useEntryListItem({ entry });

  return (
    <li
      className={`p-2 rounded cursor-pointer transition-colors ${
        selected ? "bg-blue-100 ring-1 ring-blue-300" : "bg-gray-100 hover:bg-gray-200"
      }`}
      onClick={() => onSelect(entry.id)}
    >
      <div className="flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm truncate">{displayTitle}</div>
          <div className="text-xs text-gray-500">
            {createdAtLabel}
            <br />
            {entry.duration_seconds !== null && <span className="ml-2">{durationLabel}</span>}
          </div>
          {entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span key={tag.id} className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {progress !== undefined && <span>Transcribing: {progress}%</span>}
        </div>
        <div className="flex gap-1 ml-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPlay(entry);
            }}
            className="px-2 py-1 text-blue-500 hover:bg-blue-100 rounded"
          >
            {playing ? "Stop" : "Play"}
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onDelete(entry.id);
            }}
            className="px-2 py-1 text-red-500 hover:bg-red-100 rounded"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}
