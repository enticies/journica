import { ReactNode } from "react";

export interface TreeNode<T> {
  id: string;
  data: T;
  children: TreeNode<T>[];
}

export interface TreeNodeRenderOpts<T> {
  node: TreeNode<T>;
  depth: number;
  isExpanded: boolean;
  hasChildren: boolean;
  toggle: () => void;
}

interface TreeViewProps<T> {
  nodes: TreeNode<T>[];
  expandedIds: Set<string>;
  onToggleExpanded: (nodeId: string) => void;
  renderNode: (opts: TreeNodeRenderOpts<T>) => ReactNode;
  canExpand?: (node: TreeNode<T>, depth: number) => boolean;
  depth?: number;
  className?: string;
  childClassName?: string;
}

function defaultCanExpand<T>(node: TreeNode<T>, _depth: number): boolean {
  return node.children.length > 0;
}

export function TreeView<T>({
  nodes,
  expandedIds,
  onToggleExpanded,
  renderNode,
  canExpand = defaultCanExpand,
  depth = 0,
  className,
  childClassName,
}: TreeViewProps<T>) {
  if (nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? className : childClassName}>
      {nodes.map((node) => {
        const hasChildren = node.children.length > 0;
        const expandable = canExpand(node, depth);
        const isExpanded = expandable && expandedIds.has(node.id);

        return (
          <li key={node.id}>
            {renderNode({
              node,
              depth,
              isExpanded,
              hasChildren,
              toggle: () => onToggleExpanded(node.id),
            })}
            {isExpanded && (
              <TreeView
                nodes={node.children}
                expandedIds={expandedIds}
                onToggleExpanded={onToggleExpanded}
                renderNode={renderNode}
                canExpand={canExpand}
                depth={depth + 1}
                className={className}
                childClassName={childClassName}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
