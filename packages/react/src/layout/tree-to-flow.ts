import type { Node, Edge } from '@xyflow/react';
import { NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { SerializableValue } from '@behavior-tree-ist/core';
import type { TreeIndex } from '@behavior-tree-ist/core/inspector';
import type { BTNodeData, BTEdgeData } from '../types';
import { getCapabilityBadges, getNodeVisualKind } from '../constants';

export function treeIndexToFlowElements(treeIndex: TreeIndex): {
  nodes: Node<BTNodeData>[];
  edges: Edge<BTEdgeData>[];
} {
  const nodes: Node<BTNodeData>[] = [];
  const edges: Edge<BTEdgeData>[] = [];

  const rootId = treeIndex.preOrder[0];
  if (rootId === undefined) return { nodes, edges };

  const visitedHosts = new Set<number>();

  const walkHost = (logicalNodeId: number, parentHostId: number | undefined) => {
    let currentId: number | undefined = logicalNodeId;
    const stackedDecoratorIds: number[] = [];
    const lifecycleDecoratorIds: number[] = [];

    while (currentId !== undefined) {
      const current = treeIndex.getById(currentId);
      if (!current) return;
      const isDecorator = hasFlag(current.nodeFlags, NodeFlags.Decorator);
      const isSubTreeBoundary = hasFlag(current.nodeFlags, NodeFlags.SubTree);
      if (!isDecorator || isSubTreeBoundary) break;

      if (hasFlag(current.nodeFlags, NodeFlags.Lifecycle)) {
        lifecycleDecoratorIds.push(current.id);
      } else {
        stackedDecoratorIds.push(current.id);
      }

      const nextChildId = current.childrenIds[0];
      if (nextChildId === undefined) break;
      currentId = nextChildId;
    }

    const baseId = currentId ?? logicalNodeId;
    const baseNode = treeIndex.getById(baseId);
    if (!baseNode || visitedHosts.has(baseId)) return;
    const baseNodeMetadata = (baseNode as typeof baseNode & {
      metadata?: Readonly<Record<string, SerializableValue>>;
    }).metadata;
    visitedHosts.add(baseId);

    const stackedDecorators = stackedDecoratorIds
      .map((id) => treeIndex.getById(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => {
        const metadata = (entry as typeof entry & {
          metadata?: Readonly<Record<string, SerializableValue>>;
        }).metadata;
        return {
          nodeId: entry.id,
          name: entry.name,
          defaultName: entry.defaultName,
          nodeFlags: entry.nodeFlags,
          result: null,
          displayState: undefined,
          displayStateIsStale: false,
          metadata,
          refEvents: [],
        };
      });

    const lifecycleDecorators = lifecycleDecoratorIds
      .map((id) => treeIndex.getById(id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .map((entry) => ({
        nodeId: entry.id,
        name: entry.name,
        defaultName: entry.defaultName,
        nodeFlags: entry.nodeFlags,
      }));

    nodes.push({
      id: String(baseId),
      type: 'btNode',
      position: { x: 0, y: 0 },
      data: {
        nodeId: baseId,
        name: baseNode.name,
        defaultName: baseNode.defaultName,
        nodeFlags: baseNode.nodeFlags,
        visualKind: getNodeVisualKind(baseNode.nodeFlags, baseNode.defaultName),
        capabilityBadges: getCapabilityBadges(baseNode.nodeFlags),
        result: null,
        displayState: undefined,
        displayStateIsStale: false,
        metadata: baseNodeMetadata,
        isSelected: false,
        isOnActivityPath: false,
        isActivityTail: false,
        depth: baseNode.depth,
        representedNodeIds: [baseId, ...stackedDecoratorIds, ...lifecycleDecoratorIds],
        stackedDecorators,
        lifecycleDecorators,
        refEvents: [],
        selectedNodeId: null,
      },
    });

    if (parentHostId !== undefined) {
      edges.push({
        id: `e-${parentHostId}-${baseId}`,
        source: String(parentHostId),
        target: String(baseId),
        type: 'btEdge',
        data: { childResult: null, isOnActivityPathEdge: false },
      });
    }

    for (const childId of baseNode.childrenIds) {
      walkHost(childId, baseId);
    }
  };

  walkHost(rootId, undefined);

  return { nodes, edges };
}
