import { useMemo, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { NodeResult, NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { BTNodeData, BTEdgeData } from '../types';

export function useSnapshotOverlay(
  baseNodes: Node<BTNodeData>[],
  baseEdges: Edge<BTEdgeData>[],
  inspector: TreeInspector,
  tickId: number | null,
  selectedNodeId: number | null,
  refEventsByNodeId: Map<number, RefChangeEvent[]>,
  onSelectNode: (nodeId: number) => void,
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

    const isNodeSelected = (representedNodeIds: number[]): boolean => {
      if (selectedNodeId === null) return false;
      return representedNodeIds.includes(selectedNodeId);
    };

    const snapshot = tickId === null
      ? undefined
      : inspector.getSnapshotAtTick(tickId);

    const inspectorWithStateLookup = inspector as TreeInspector & {
      getLastDisplayState?: (nodeId: number, atOrBeforeTickId?: number) => unknown;
    };

    const rememberedStateByNode = new Map<number, Record<string, unknown> | undefined>();
    const representedNodeIdToHostNodeId = new Map<number, number>();
    const stateLookupTick = tickId ?? undefined;

    for (const node of baseNodes) {
      for (const representedNodeId of node.data.representedNodeIds) {
        representedNodeIdToHostNodeId.set(representedNodeId, node.data.nodeId);
      }

      const latestState = inspectorWithStateLookup.getLastDisplayState?.(node.data.nodeId, stateLookupTick);
      rememberedStateByNode.set(
        node.data.nodeId,
        latestState as Record<string, unknown> | undefined,
      );
      for (const decorator of node.data.stackedDecorators) {
        const decoratorState = inspectorWithStateLookup.getLastDisplayState?.(decorator.nodeId, stateLookupTick);
        rememberedStateByNode.set(
          decorator.nodeId,
          decoratorState as Record<string, unknown> | undefined,
        );
      }
    }

    const utilityDecoratorStateByNodeId = new Map<number, {
      displayState: Record<string, unknown>;
      isStale: boolean;
    }>();

    const treeIndex = inspector.tree;
    if (treeIndex) {
      for (const parentNode of baseNodes) {
        if (!hasFlag(parentNode.data.nodeFlags, NodeFlags.Composite) || !hasFlag(parentNode.data.nodeFlags, NodeFlags.Utility)) {
          continue;
        }

        const indexedParent = treeIndex.getById(parentNode.data.nodeId);
        if (!indexedParent) continue;

        const parentSnapshot = snapshot?.nodes.get(parentNode.data.nodeId);
        const parentSnapshotState = parentSnapshot?.state as Record<string, unknown> | undefined;
        const parentFallbackState = rememberedStateByNode.get(parentNode.data.nodeId);
        const parentDisplayState = parentSnapshotState ?? parentFallbackState;
        const parentStateIsStale = parentDisplayState !== undefined
          && tickId !== null
          && (parentSnapshot === undefined || parentSnapshotState === undefined);

        const scores = getUtilityScores(parentDisplayState);
        if (!scores) continue;

        for (let childIndex = 0; childIndex < scores.length; childIndex++) {
          const lastScore = scores[childIndex];
          const utilityDecoratorNodeId = indexedParent.childrenIds[childIndex];
          if (utilityDecoratorNodeId === undefined) continue;

          const hostNodeId = representedNodeIdToHostNodeId.get(utilityDecoratorNodeId);
          if (hostNodeId === undefined) continue;

          utilityDecoratorStateByNodeId.set(utilityDecoratorNodeId, {
            displayState: { lastScore },
            isStale: parentStateIsStale,
          });
        }
      }
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
      const snapshotState = nodeSnapshot?.state as Record<string, unknown> | undefined;
      const fallbackState = rememberedStateByNode.get(baseNode.data.nodeId);
      const nextDisplayState = snapshotState ?? fallbackState;
      const nextDisplayStateIsStale = nextDisplayState !== undefined
        && tickId !== null
        && (nodeSnapshot === undefined || snapshotState === undefined);
      const nextIsSelected = isNodeSelected(baseNode.data.representedNodeIds);
      const nextRefEvents = (refEventsByNodeId.get(baseNode.data.nodeId) ?? []).map((event) => ({
        refName: event.refName,
        newValue: event.newValue,
        isAsync: event.isAsync,
      }));

      const nextStackedDecorators = baseNode.data.stackedDecorators.map((decorator) => {
        const decoratorSnapshot = snapshot?.nodes.get(decorator.nodeId);
        const decoratorSnapshotState = decoratorSnapshot?.state as Record<string, unknown> | undefined;
        const decoratorFallbackState = rememberedStateByNode.get(decorator.nodeId);
        const syntheticUtilityState = utilityDecoratorStateByNodeId.get(decorator.nodeId);

        const decoratorDisplayState = decoratorSnapshotState
          ?? syntheticUtilityState?.displayState
          ?? decoratorFallbackState;

        const decoratorStateStale = decoratorSnapshotState !== undefined
          ? false
          : syntheticUtilityState
            ? syntheticUtilityState.isStale
            : (decoratorDisplayState !== undefined
              && tickId !== null
              && (decoratorSnapshot === undefined || decoratorSnapshotState === undefined));
        const decoratorRefEvents = (refEventsByNodeId.get(decorator.nodeId) ?? []).map((event) => ({
          refName: event.refName,
          newValue: event.newValue,
          isAsync: event.isAsync,
        }));

        return {
          ...decorator,
          result: decoratorSnapshot?.result ?? null,
          displayState: decoratorDisplayState,
          displayStateIsStale: decoratorStateStale,
          refEvents: decoratorRefEvents,
        };
      });

      const previousNode = previousNodesById.get(baseNode.id);
      if (
        previousNode
        && hasSameBaseNodeShape(previousNode, baseNode)
        && previousNode.data.result === nextResult
        && previousNode.data.isSelected === nextIsSelected
        && previousNode.selected === nextIsSelected
        && previousNode.data.displayStateIsStale === nextDisplayStateIsStale
        && shallowEqualRecord(previousNode.data.displayState, nextDisplayState)
        && shallowEqualRefEvents(previousNode.data.refEvents, nextRefEvents)
        && shallowEqualDecoratorData(previousNode.data.stackedDecorators, nextStackedDecorators)
        && previousNode.data.selectedNodeId === selectedNodeId
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
          displayStateIsStale: nextDisplayStateIsStale,
          isSelected: nextIsSelected,
          refEvents: nextRefEvents,
          stackedDecorators: nextStackedDecorators,
          selectedNodeId,
          onSelectNode,
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
  }, [baseNodes, baseEdges, inspector, tickId, selectedNodeId, refEventsByNodeId, onSelectNode, tickGeneration]);
}

function getUtilityScores(
  displayState: Record<string, unknown> | undefined,
): number[] | undefined {
  if (!displayState) return undefined;

  const maybeScores = displayState.lastScores;
  if (!Array.isArray(maybeScores)) return undefined;

  const scores: number[] = [];
  for (const maybeScore of maybeScores) {
    if (typeof maybeScore !== 'number') continue;
    scores.push(maybeScore);
  }

  return scores;
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
    && previousNode.data.visualKind === baseNode.data.visualKind
    && previousNode.data.depth === baseNode.data.depth
    && previousNode.data.stackedDecorators.length === baseNode.data.stackedDecorators.length
    && previousNode.data.lifecycleDecorators.length === baseNode.data.lifecycleDecorators.length
    && previousNode.data.representedNodeIds.length === baseNode.data.representedNodeIds.length;
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

function shallowEqualRefEvents(
  left: BTNodeData['refEvents'],
  right: BTNodeData['refEvents'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i].refName !== right[i].refName) return false;
    if (!Object.is(left[i].newValue, right[i].newValue)) return false;
    if (left[i].isAsync !== right[i].isAsync) return false;
  }
  return true;
}

function shallowEqualDecoratorData(
  left: BTNodeData['stackedDecorators'],
  right: BTNodeData['stackedDecorators'],
): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) {
    if (left[i].nodeId !== right[i].nodeId) return false;
    if (left[i].result !== right[i].result) return false;
    if (left[i].displayStateIsStale !== right[i].displayStateIsStale) return false;
    if (!shallowEqualRecord(left[i].displayState, right[i].displayState)) return false;
    if (!shallowEqualRefEvents(left[i].refEvents, right[i].refEvents)) return false;
  }
  return true;
}
