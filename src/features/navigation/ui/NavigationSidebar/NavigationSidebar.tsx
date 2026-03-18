import { Typography } from "../../../../shared/ui/Typography";
import { FolderNode } from "../../hooks/useFolderTree";
import { JournalTree } from "../JournalTree";
import { NavigationSearch } from "../NavigationSearch";

interface Props {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isRecording: boolean;
  onNewEntry: () => void;
  journalNodes: FolderNode[];
  expandedIds: Set<string>;
  selectedFolderId: string | null;
  onToggleExpanded: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
}

export function NavigationSidebar({
  searchQuery,
  onSearchQueryChange,
  isRecording,
  onNewEntry,
  journalNodes,
  expandedIds,
  selectedFolderId,
  onToggleExpanded,
  onSelectFolder,
}: Props) {
  return (
    <div className="h-full flex flex-col bg-light-50 border-r">
      <div className="p-3">
        <NavigationSearch value={searchQuery} onChange={onSearchQueryChange} />
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={onNewEntry}
          className={`w-full px-3 py-2 text-sm font-semibold rounded transition-colors ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          {isRecording ? "Stop Recording" : "New Entry"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <Typography variant="caption" className="uppercase tracking-wider text-gray-500 mb-2 block">
          Journal
        </Typography>
        <JournalTree
          nodes={journalNodes}
          expandedIds={expandedIds}
          selectedFolderId={selectedFolderId}
          onToggleExpanded={onToggleExpanded}
          onSelectFolder={onSelectFolder}
        />
      </div>
    </div>
  );
}
