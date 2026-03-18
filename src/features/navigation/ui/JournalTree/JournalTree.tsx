import { FolderNode } from "../../hooks/useFolderTree";
import { ChevronRightIcon } from "../icons/ChevronRightIcon";

interface Props {
  nodes: FolderNode[];
  expandedIds: Set<string>;
  selectedFolderId: string | null;
  onToggleExpanded: (folderId: string) => void;
  onSelectFolder: (folderId: string) => void;
  depth?: number;
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

export function JournalTree({
  nodes,
  expandedIds,
  selectedFolderId,
  onToggleExpanded,
  onSelectFolder,
  depth = 0,
}: Props) {
  if (nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? "" : "ml-3"}>
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.folder.id);
        const isSelected = selectedFolderId === node.folder.id;
        const hasChildren = node.children.length > 0;
        const label = formatNodeLabel(node.folder.name, depth);

        return (
          <li key={node.folder.id}>
            <button
              className={`w-full text-left px-2 py-1 text-sm rounded flex items-center gap-1 ${
                isSelected
                  ? "bg-light-50 font-semibold"
                  : "hover:bg-light-50"
              }`}
              onClick={() => {
                if (hasChildren) {
                  onToggleExpanded(node.folder.id);
                }
                onSelectFolder(node.folder.id);
              }}
            >
              {hasChildren && (
                <span className="w-4 h-4 flex items-center justify-center select-none">
                  <ChevronRightIcon expanded={isExpanded} />
                </span>
              )}
              {!hasChildren && <span className="w-4" />}
              <span className="truncate">{label}</span>
            </button>
            {isExpanded && hasChildren && (
              <JournalTree
                nodes={node.children}
                expandedIds={expandedIds}
                selectedFolderId={selectedFolderId}
                onToggleExpanded={onToggleExpanded}
                onSelectFolder={onSelectFolder}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
