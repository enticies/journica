import { Typography } from "../../../../shared/ui/Typography";
import { FolderNode } from "../../hooks/useFolderTree";
import { JournalTree } from "../JournalTree";
import { NavigationSearch } from "../NavigationSearch";

interface Props {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isRecording: boolean;
  onNewEntry: () => void;
  totalEntries: number;
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
  totalEntries,
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
          className="mx-auto flex w-full items-center justify-center gap-1.5 rounded-[22px] bg-dark-90 px-3 py-2.25 text-sm font-semibold text-white transition-colors hover:opacity-90 cursor-pointer"
        >
          <div className="flex gap-1.5 justify-center items-center font-normal text-[13px] tracking-[-0.076px]">
            <span aria-hidden>+</span>
            <span>{isRecording ? "Stop Recording" : "New Entry"}</span>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex justify-between text-center pr-5">
          <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
            Journal
          </Typography>
          <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
            {totalEntries}
          </Typography>
        </div>
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
