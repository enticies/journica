import { useCallback } from "react";
import { Typography } from "../../../../shared/ui/Typography";
import { TreeView, TreeNodeRenderOpts } from "../../../../shared/ui/TreeView";
import { SidebarListItem } from "../../../../shared/ui/SidebarListItem";
import { FolderNode } from "../../hooks/useFolderTree";
import { Folder } from "../../../recordings/model/types";
import { ChevronRightIcon } from "../icons/ChevronRightIcon";

interface Props {
  nodes: FolderNode[];
  expandedIds: Set<string>;
  selectedFolderId: string | null;
  onToggleExpanded: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
}

const MONTH_LABELS: Record<string, string> = {
  "01": "January",
  "02": "February",
  "03": "March",
  "04": "April",
  "05": "May",
  "06": "June",
  "07": "July",
  "08": "August",
  "09": "September",
  "10": "October",
  "11": "November",
  "12": "December",
};

function formatNodeLabel(name: string, depth: number): string {
  if (depth === 1) {
    return MONTH_LABELS[name] ?? name;
  }
  return name;
}

function canExpand(node: FolderNode, depth: number): boolean {
  return node.children.length > 0 && depth === 0;
}

export function JournalTree({
  nodes,
  expandedIds,
  selectedFolderId,
  onToggleExpanded,
  onSelectFolder,
}: Props) {
  const renderNode = useCallback(
    ({ node, depth, isExpanded, hasChildren, toggle }: TreeNodeRenderOpts<Folder>) => {
      const isSelected = selectedFolderId === node.id;
      const expandable = hasChildren && depth === 0;
      const label = formatNodeLabel(node.data.name, depth);
      const showEntryCount = depth === 1;

      return (
        <SidebarListItem
          className="px-2"
          selected={isSelected}
          selectedClassName="bg-light-80 font-semibold hover:bg-light-80"
          onClick={() => {
            if (expandable) {
              toggle();
            }
            onSelectFolder(node.id);
          }}
          leading={expandable ? (
            <span className="w-4 h-4 flex items-center justify-center select-none">
              <ChevronRightIcon expanded={isExpanded} />
            </span>
          ) : (
            <span className="w-4" />
          )}
          label={label}
          trailing={showEntryCount ? (
            <Typography variant="caption" className="uppercase font-normal leading-3.75 text-dark-30">
              {node.data.entry_count}
            </Typography>
          ) : undefined}
        />
      );
    },
    [selectedFolderId, onSelectFolder],
  );

  return (
    <TreeView<Folder>
      nodes={nodes}
      expandedIds={expandedIds}
      onToggleExpanded={onToggleExpanded}
      renderNode={renderNode}
      canExpand={canExpand}
      childClassName="ml-3"
    />
  );
}
