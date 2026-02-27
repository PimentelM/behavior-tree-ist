import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { TreeIndex } from '@behavior-tree-ist/core/inspector';
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
): UseTreeLayoutResult {
  return useMemo(() => {
    if (!treeIndex) return { nodes: [], edges: [] };
    const { nodes, edges } = treeIndexToFlowElements(treeIndex);
    return applyDagreLayout(nodes, edges, direction);
  }, [treeIndex, direction]);
}
