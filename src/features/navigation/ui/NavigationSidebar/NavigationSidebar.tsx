import { Typography } from "../../../../shared/ui/Typography";
import { SidebarListItem } from "../../../../shared/ui/SidebarListItem";
import { Tag } from "../../../recordings/model/types";
import { TagManager } from "../../../recordings/ui/TagManager";
import { FolderNode } from "../../hooks/useFolderTree";
import { useNavigationSidebar } from "../../hooks/useNavigationSidebar";
import { useNewTagModal } from "../../hooks/useNewTagModal";
import { JournalTree } from "../JournalTree";
import { NewFolderModal } from "../NewFolderModal";
import { NavigationSearch } from "../NavigationSearch";
import { FolderIcon } from "../icons/FolderIcon";
import { PauseIcon } from "../icons/PauseIcon";
import { PlayIcon } from "../icons/PlayIcon";
import { PlusIcon } from "../icons/PlusIcon";
import { StopIcon } from "../icons/StopIcon";

interface Props {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isRecording: boolean;
  isRecordingPaused: boolean;
  recordingDurationSeconds: number;
  onNewEntry: () => void;
  onStopEntry: () => void;
  journalNodes: FolderNode[];
  userNodes: FolderNode[];
  expandedIds: Set<string>;
  selectedFolderId: string | null;
  tags: Tag[];
  selectedFilterTagIds: string[];
  onToggleExpanded: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onSelectedFilterTagIdsChange: (tagIds: string[]) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

export function NavigationSidebar({
  searchQuery,
  onSearchQueryChange,
  isRecording,
  isRecordingPaused,
  recordingDurationSeconds,
  onNewEntry,
  onStopEntry,
  journalNodes,
  userNodes,
  expandedIds,
  selectedFolderId,
  tags,
  selectedFilterTagIds,
  onToggleExpanded,
  onSelectFolder,
  onSelectedFilterTagIdsChange,
  onCreateFolder,
  onCreateTag,
}: Props) {
  const newTagModal = useNewTagModal({ onCreateTag });
  const { newFolderModal, flatUserNodes, onSelectUserFolder, isUserFolderSelected } = useNavigationSidebar({
    selectedFolderId,
    userNodes,
    onSelectFolder,
    onCreateFolder,
  });

  const minutes = String(Math.floor(recordingDurationSeconds / 60)).padStart(2, "0");
  const seconds = String(recordingDurationSeconds % 60).padStart(2, "0");

  return (
    <div className="h-full flex flex-col bg-light-50 border-r border-light-base">


      <div className="px-3 pb-3 pt-8">
        <div className="flex items-center gap-2">
          <button
            onClick={onNewEntry}
            aria-label={!isRecording ? "Start recording" : isRecordingPaused ? "Resume recording" : "Pause recording"}
            title={!isRecording ? "Start" : isRecordingPaused ? "Resume" : "Pause"}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-dark-90 text-white transition-colors hover:bg-dark-70"
          >
            {isRecording && !isRecordingPaused ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
          </button>



          <button
            onClick={onStopEntry}
            disabled={!isRecording}
            aria-label="Stop recording"
            title="Stop recording"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dark-20 text-dark-70 transition-colors hover:bg-light-30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <StopIcon className="size-4" />
          </button>

          <span className="flex h-10 w-fit min-w-18 items-center justify-center rounded-full border border-light-base bg-light-20 px-3 font-mono text-sm font-semibold tabular-nums text-dark-80">
            {minutes}:{seconds}
          </span>
        </div>
      </div>

      <div className="p-3">
        <NavigationSearch value={searchQuery} onChange={onSearchQueryChange} />
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="[&>*]:text-[15px] flex justify-between text-center ">
          <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
            Journal
          </Typography>
        </div>
        <JournalTree
          nodes={journalNodes}
          expandedIds={expandedIds}
          selectedFolderId={selectedFolderId}
          onToggleExpanded={onToggleExpanded}
          onSelectFolder={onSelectFolder}
        />

        <hr className="my-3 border-light-base" />

        <div className="[&>*]:text-[15px] flex justify-between text-center">
          <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
            Folders
          </Typography>
          <PlusIcon className="cursor-pointer text-dark-30" onClick={newFolderModal.open} />
        </div>

        <ul>
          {flatUserNodes.map((node) => {
            const isSelected = isUserFolderSelected(node.id);

            return (
              <SidebarListItem
                key={node.id}
                asListItem
                icon={<FolderIcon />}
                label={node.data.name}
                selected={isSelected}
                selectedClassName="bg-light-80 font-semibold hover:bg-light-80"
                onClick={() => {
                  onSelectUserFolder(node.id);
                }}
                trailing={
                  <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30 pr-2">
                    {node.data.entry_count}
                  </Typography>
                }
              />
            );
          })}
        </ul>

        <hr className="my-3 border-light-base" />

        <div className="[&>*]:text-[15px] flex justify-between text-center">
          <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
            Tags
          </Typography>
          <PlusIcon className="cursor-pointer text-dark-30" onClick={newTagModal.open} />
        </div>
        <TagManager
          tags={tags}
          selectedFilterTagIds={selectedFilterTagIds}
          onSelectedFilterTagIdsChange={onSelectedFilterTagIdsChange}
        />
      </div>

      <NewFolderModal
        isOpen={newFolderModal.isOpen}
        value={newFolderModal.name}
        isSaving={newFolderModal.isSaving}
        canSave={newFolderModal.canSave}
        errorMessage={newFolderModal.errorMessage}
        onValueChange={newFolderModal.handleNameChange}
        onInputKeyDown={newFolderModal.handleInputKeyDown}
        onClose={newFolderModal.close}
        onSave={() => {
          void newFolderModal.save();
        }}
      />

      <NewFolderModal
        isOpen={newTagModal.isOpen}
        value={newTagModal.name}
        isSaving={newTagModal.isSaving}
        canSave={newTagModal.canSave}
        errorMessage={newTagModal.errorMessage}
        title="New Tag"
        ariaLabel="New tag"
        placeholder="Tag name"
        onValueChange={newTagModal.handleNameChange}
        onInputKeyDown={newTagModal.handleInputKeyDown}
        onClose={newTagModal.close}
        onSave={() => {
          void newTagModal.save();
        }}
      />
    </div>
  );
}
