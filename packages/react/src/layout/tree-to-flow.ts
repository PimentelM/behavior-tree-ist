import type { Node, Edge } from '@xyflow/react';
import type { TreeIndex } from '@behavior-tree-ist/core/inspector';
import type { BTNodeData, BTEdgeData } from '../types';

export function treeIndexToFlowElements(treeIndex: TreeIndex): {
  nodes: Node<BTNodeData>[];
  edges: Edge<BTEdgeData>[];
} {
  const nodes: Node<BTNodeData>[] = [];
  const edges: Edge<BTEdgeData>[] = [];

  for (const nodeId of treeIndex.preOrder) {
    const indexed = treeIndex.getById(nodeId);
    if (!indexed) continue;

    nodes.push({
      id: String(nodeId),
      type: 'btNode',
      position: { x: 0, y: 0 }, // dagre will set this
      data: {
        nodeId,
        name: indexed.name || indexed.defaultName,
        defaultName: indexed.defaultName,
        nodeFlags: indexed.nodeFlags,
        result: null,
        displayState: undefined,
        isSelected: false,
        depth: indexed.depth,
      },
    });

    if (indexed.parentId !== undefined) {
      edges.push({
        id: `e-${indexed.parentId}-${nodeId}`,
        source: String(indexed.parentId),
        target: String(nodeId),
        type: 'btEdge',
        data: { childResult: null },
      });
    }
  }

  return { nodes, edges };
}
