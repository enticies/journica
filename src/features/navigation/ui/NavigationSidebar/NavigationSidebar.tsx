import { Typography } from "../../../../shared/ui/Typography";
import { Tag } from "../../../recordings/model/types";
import { TagManager } from "../../../recordings/ui/TagManager";
import { FolderNode } from "../../hooks/useFolderTree";
import { useNavigationSidebar } from "../../hooks/useNavigationSidebar";
import { useNewTagModal } from "../../hooks/useNewTagModal";
import { JournalTree } from "../JournalTree";
import { NewFolderModal } from "../NewFolderModal";
import { NavigationSearch } from "../NavigationSearch";
import { FolderIcon } from "../icons/FolderIcon";
import { PlusIcon } from "../icons/PlusIcon";

interface Props {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isRecording: boolean;
  onNewEntry: () => void;
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
  onNewEntry,
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
              <li key={node.id}>
                <button
                  className={`w-full text-left py-1 text-sm rounded flex items-center gap-1 ${isSelected
                    ? "bg-light-50 font-semibold"
                    : "hover:bg-light-50"
                    }`}
                  onClick={() => {
                    onSelectUserFolder(node.id);
                  }}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1">
                      <FolderIcon />
                      <span
                        style={{ fontWeight: "400" }}
                        className="truncate block text-[18px] font-normal leading-[19.5px] tracking-[-0.076px] text-dark-90"
                      >
                        {node.data.name}
                      </span>
                    </span>
                    <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30 pr-2">
                      {node.data.entry_count}
                    </Typography>
                  </span>
                </button>
              </li>
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
