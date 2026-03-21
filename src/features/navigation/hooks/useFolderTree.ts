import { useCallback, useEffect, useState } from "react";
import { listFolders } from "../../recordings/api/recordingsApi";
import { Folder } from "../../recordings/model/types";

export interface FolderNode {
  folder: Folder;
  children: FolderNode[];
}

function buildTree(folders: Folder[]): FolderNode[] {
  const byParent = new Map<string, Folder[]>();

  for (const folder of folders) {
    const parentKey = folder.parent_id ?? "__root__";
    const siblings = byParent.get(parentKey) ?? [];
    siblings.push(folder);
    byParent.set(parentKey, siblings);
  }

  function buildChildren(parentId: string): FolderNode[] {
    const children = byParent.get(parentId) ?? [];
    return children.map((folder) => ({
      folder,
      children: buildChildren(folder.id),
    }));
  }

  const rootFolder = folders.find((f) => f.id === "root");
  if (!rootFolder) return [];

  return buildChildren("root");
}

function isDateName(name: string): boolean {
  return /^\d{2,4}$/.test(name);
}

function splitTree(nodes: FolderNode[]): {
  journalNodes: FolderNode[];
  userNodes: FolderNode[];
} {
  const journalNodes: FolderNode[] = [];
  const userNodes: FolderNode[] = [];

  for (const node of nodes) {
    if (isDateName(node.folder.name)) {
      journalNodes.push(node);
    } else {
      userNodes.push(node);
    }
  }

  journalNodes.sort((a, b) => b.folder.name.localeCompare(a.folder.name));

  return { journalNodes, userNodes };
}

function todayKeys(): { year: string } {
  const now = new Date();
  return {
    year: String(now.getFullYear()).padStart(4, "0"),
  };
}

function defaultExpanded(journalNodes: FolderNode[]): Set<string> {
  const expanded = new Set<string>();
  const { year } = todayKeys();

  const yearNode = journalNodes.find((n) => n.folder.name === year);
  if (!yearNode) return expanded;
  expanded.add(yearNode.folder.id);

  return expanded;
}

export function useFolderTree() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await listFolders();
      setFolders(result);
    } catch (error) {
      console.error("Failed to load folders:", error);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topLevel = buildTree(folders);
  const { journalNodes, userNodes } = splitTree(topLevel);

  useEffect(() => {
    if (initialized || journalNodes.length === 0) return;
    setExpandedIds(defaultExpanded(journalNodes));
    setInitialized(true);
  }, [initialized, journalNodes]);

  const toggleExpanded = useCallback((folderId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  return {
    journalNodes,
    userNodes,
    expandedIds,
    toggleExpanded,
    selectedFolderId,
    setSelectedFolderId,
    reloadFolders: load,
  };
}
