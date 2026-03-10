import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TreeIndex } from '@bt-studio/core/inspector';
import type { BTNodeData, BTEdgeData, LayoutDirection } from '../types';
import { treeIndexToFlowElements } from '../layout/tree-to-flow';
import { applyDagreLayout } from '../layout/dagre-layout';

export interface UseTreeLayoutResult {
  nodes: Node<BTNodeData>[];
  edges: Edge<BTEdgeData>[];
}

export function useTreeLayout(
  treeIndex: TreeIndex | undefined,
  direction: LayoutDirection = 'TB',
  collapsedSubTrees?: ReadonlySet<number>,
): UseTreeLayoutResult {
  return useMemo(() => {
    if (!treeIndex) return { nodes: [], edges: [] };
    const { nodes, edges } = treeIndexToFlowElements(treeIndex);

    if (!collapsedSubTrees || collapsedSubTrees.size === 0) {
      return applyDagreLayout(nodes, edges, direction);
    }

    // Build parent map from edges: target → source (flow node IDs are string)
    const parentMap = new Map<string, string>();
    for (const edge of edges) {
      parentMap.set(edge.target, edge.source);
    }

    // Find which collapsed subtree (if any) is an ancestor of a given flow node
    const collapsedSubTreeIdStrings = new Set(
      Array.from(collapsedSubTrees).map(String),
    );

    const hiddenNodeIds = new Set<string>();
    const childCountBySubTree = new Map<string, number>();

    for (const node of nodes) {
      if (collapsedSubTreeIdStrings.has(node.id)) continue;

      // Walk up ancestors to check if any is a collapsed subtree
      let current = parentMap.get(node.id);
      while (current !== undefined) {
        if (collapsedSubTreeIdStrings.has(current)) {
          hiddenNodeIds.add(node.id);
          childCountBySubTree.set(current, (childCountBySubTree.get(current) ?? 0) + 1);
          break;
        }
        current = parentMap.get(current);
      }
    }

    // Mark collapsed subtree nodes with their child count
    const filteredNodes = nodes
      .filter((node) => !hiddenNodeIds.has(node.id))
      .map((node) => {
        if (!collapsedSubTreeIdStrings.has(node.id)) return node;
        const count = childCountBySubTree.get(node.id) ?? 0;
        return {
          ...node,
          data: {
            ...node.data,
            isCollapsed: true,
            collapsedChildCount: count,
          },
        };
      });

    const filteredEdges = edges.filter(
      (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target),
    );

    return applyDagreLayout(filteredNodes, filteredEdges, direction);
  }, [treeIndex, direction, collapsedSubTrees]);
}
