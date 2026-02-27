import { useMemo, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { NodeResult } from '@behavior-tree-ist/core';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { BTNodeData, BTEdgeData } from '../types';

export function useSnapshotOverlay(
  baseNodes: Node<BTNodeData>[],
  baseEdges: Edge<BTEdgeData>[],
  inspector: TreeInspector,
  tickId: number | null,
  selectedNodeId: number | null,
  tickGeneration: number,
): { nodes: Node<BTNodeData>[]; edges: Edge<BTEdgeData>[] } {
  const previousRef = useRef<{
    nodesById: Map<string, Node<BTNodeData>>;
    edgesById: Map<string, Edge<BTEdgeData>>;
  }>({
    nodesById: new Map(),
    edgesById: new Map(),
  });

  return useMemo(() => {
    const previousNodesById = previousRef.current.nodesById;
    const previousEdgesById = previousRef.current.edgesById;

    const nextNodesById = new Map<string, Node<BTNodeData>>();
    const nextEdgesById = new Map<string, Edge<BTEdgeData>>();

    const isNodeSelected = (nodeId: number): boolean => nodeId === selectedNodeId;

    const snapshot = tickId === null
      ? undefined
      : inspector.getSnapshotAtTick(tickId);

    const inspectorWithStateLookup = inspector as TreeInspector & {
      getLastDisplayState?: (nodeId: number, atOrBeforeTickId?: number) => unknown;
    };

    const rememberedStateByNode = new Map<number, Record<string, unknown> | undefined>();
    const stateLookupTick = tickId ?? undefined;

    for (const node of baseNodes) {
      const latestState = inspectorWithStateLookup.getLastDisplayState?.(node.data.nodeId, stateLookupTick);
      rememberedStateByNode.set(
        node.data.nodeId,
        latestState as Record<string, unknown> | undefined,
      );
    }

    const nodeResultById = new Map<number, NodeResult>();
    if (snapshot) {
      for (const [nodeId, nodeSnapshot] of snapshot.nodes) {
        nodeResultById.set(nodeId, nodeSnapshot.result);
      }
    }

    const nodes = baseNodes.map((baseNode) => {
      const nodeSnapshot = snapshot?.nodes.get(baseNode.data.nodeId);
      const nextResult = nodeSnapshot?.result ?? null;
      const nextDisplayState = (nodeSnapshot?.state as Record<string, unknown> | undefined)
        ?? rememberedStateByNode.get(baseNode.data.nodeId);
      const nextIsSelected = isNodeSelected(baseNode.data.nodeId);

      const previousNode = previousNodesById.get(baseNode.id);
      if (
        previousNode
        && hasSameBaseNodeShape(previousNode, baseNode)
        && previousNode.data.result === nextResult
        && previousNode.data.isSelected === nextIsSelected
        && previousNode.selected === nextIsSelected
        && shallowEqualRecord(previousNode.data.displayState, nextDisplayState)
      ) {
        nextNodesById.set(baseNode.id, previousNode);
        return previousNode;
      }

      const nextNode: Node<BTNodeData> = {
        ...baseNode,
        data: {
          ...baseNode.data,
          result: nextResult,
          displayState: nextDisplayState,
          isSelected: nextIsSelected,
        },
        selected: nextIsSelected,
      };

      nextNodesById.set(baseNode.id, nextNode);
      return nextNode;
    });

    const edges = baseEdges.map((baseEdge) => {
      const targetNodeId = parseInt(baseEdge.target, 10);
      const childResult = nodeResultById.get(targetNodeId) ?? null;
      const nextAnimated = childResult === NodeResult.Running;

      const previousEdge = previousEdgesById.get(baseEdge.id);
      if (
        previousEdge
        && hasSameBaseEdgeShape(previousEdge, baseEdge)
        && previousEdge.data?.childResult === childResult
        && previousEdge.animated === nextAnimated
      ) {
        nextEdgesById.set(baseEdge.id, previousEdge);
        return previousEdge;
      }

      const nextEdge: Edge<BTEdgeData> = {
        ...baseEdge,
        data: { ...baseEdge.data, childResult } as BTEdgeData,
        animated: nextAnimated,
      };

      nextEdgesById.set(baseEdge.id, nextEdge);
      return nextEdge;
    });

    previousRef.current = {
      nodesById: nextNodesById,
      edgesById: nextEdgesById,
    };

    return { nodes, edges };
    // tickGeneration is used to trigger re-computation when new ticks arrive
  }, [baseNodes, baseEdges, inspector, tickId, selectedNodeId, tickGeneration]);
}

function hasSameBaseNodeShape(
  previousNode: Node<BTNodeData>,
  baseNode: Node<BTNodeData>,
): boolean {
  return previousNode.type === baseNode.type
    && previousNode.parentId === baseNode.parentId
    && previousNode.position.x === baseNode.position.x
    && previousNode.position.y === baseNode.position.y
    && previousNode.data.nodeId === baseNode.data.nodeId
    && previousNode.data.name === baseNode.data.name
    && previousNode.data.defaultName === baseNode.data.defaultName
    && previousNode.data.nodeFlags === baseNode.data.nodeFlags
    && previousNode.data.depth === baseNode.data.depth;
}

function hasSameBaseEdgeShape(
  previousEdge: Edge<BTEdgeData>,
  baseEdge: Edge<BTEdgeData>,
): boolean {
  return previousEdge.type === baseEdge.type
    && previousEdge.source === baseEdge.source
    && previousEdge.target === baseEdge.target;
}

function shallowEqualRecord(
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
    if (!Object.is(left[key], right[key])) return false;
  }

  return true;
}
