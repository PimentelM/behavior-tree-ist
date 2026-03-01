import { useMemo, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { NodeResult, NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { RefChangeEvent, SerializableState, SerializableValue } from '@behavior-tree-ist/core';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { BTNodeData, BTEdgeData } from '../types';

export function useSnapshotOverlay(
  baseNodes: Node<BTNodeData>[],
  baseEdges: Edge<BTEdgeData>[],
  inspector: TreeInspector,
  tickId: number | null,
  selectedNodeId: number | null,
  activityPathNodeIds: readonly number[] | undefined,
  activityTailNodeId: number | null,
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

    const rememberedStateByNode = new Map<number, SerializableState | undefined>();
    const representedNodeIdToHostNodeId = new Map<number, number>();
    const representedNodeIdsByHostNodeId = new Map<number, number[]>();
    const highlightedHostEdgeIds = new Set<string>();
    const activityPathNodeIdsSet = activityPathNodeIds ? new Set(activityPathNodeIds) : undefined;
    const stateLookupTick = tickId ?? undefined;

    for (const node of baseNodes) {
      representedNodeIdsByHostNodeId.set(node.data.nodeId, [...node.data.representedNodeIds]);
      for (const representedNodeId of node.data.representedNodeIds) {
        representedNodeIdToHostNodeId.set(representedNodeId, node.data.nodeId);
      }

      const latestState = inspectorWithStateLookup.getLastDisplayState?.(node.data.nodeId, stateLookupTick);
      rememberedStateByNode.set(
        node.data.nodeId,
        latestState as SerializableState | undefined,
      );
      for (const decorator of node.data.stackedDecorators) {
        const decoratorState = inspectorWithStateLookup.getLastDisplayState?.(decorator.nodeId, stateLookupTick);
        rememberedStateByNode.set(
          decorator.nodeId,
          decoratorState as SerializableState | undefined,
        );
      }
    }

    if (activityPathNodeIds && activityPathNodeIds.length > 1) {
      const pathNodeIds = activityPathNodeIds;
      const pathNodeIndexById = new Map<number, number>();
      for (let i = 0; i < pathNodeIds.length; i++) {
        pathNodeIndexById.set(pathNodeIds[i], i);
      }

      for (const baseEdge of baseEdges) {
        const sourceNodeId = parseInt(baseEdge.source, 10);
        const targetNodeId = parseInt(baseEdge.target, 10);
        const sourceRepresentedNodeIds = representedNodeIdsByHostNodeId.get(sourceNodeId);
        const targetRepresentedNodeIds = representedNodeIdsByHostNodeId.get(targetNodeId);
        if (!sourceRepresentedNodeIds || !targetRepresentedNodeIds) continue;

        let sourcePathIndex = -1;
        let targetPathIndex = -1;
        for (const representedNodeId of sourceRepresentedNodeIds) {
          const index = pathNodeIndexById.get(representedNodeId);
          if (index !== undefined) sourcePathIndex = Math.max(sourcePathIndex, index);
        }
        for (const representedNodeId of targetRepresentedNodeIds) {
          const index = pathNodeIndexById.get(representedNodeId);
          if (index !== undefined && (targetPathIndex === -1 || index < targetPathIndex)) {
            targetPathIndex = index;
          }
        }

        if (sourcePathIndex === -1 || targetPathIndex === -1) continue;
        if (targetPathIndex <= sourcePathIndex) continue;
        highlightedHostEdgeIds.add(baseEdge.id);
      }
    }

    const utilityDecoratorStateByNodeId = new Map<number, {
      displayState: SerializableState;
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
        const parentSnapshotState = parentSnapshot?.state as SerializableState | undefined;
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
      const snapshotState = nodeSnapshot?.state as SerializableState | undefined;
      const fallbackState = rememberedStateByNode.get(baseNode.data.nodeId);
      const nextDisplayState = snapshotState ?? fallbackState;
      const nextDisplayStateIsStale = nextDisplayState !== undefined
        && tickId !== null
        && (nodeSnapshot === undefined || snapshotState === undefined);
      const nextIsSelected = isNodeSelected(baseNode.data.representedNodeIds);
      const nextIsOnActivityPath = activityPathNodeIdsSet !== undefined
        && baseNode.data.representedNodeIds.some((nodeId) => activityPathNodeIdsSet.has(nodeId));
      const nextIsActivityTail = activityTailNodeId !== null
        && baseNode.data.representedNodeIds.includes(activityTailNodeId);
      const nextRefEvents = (refEventsByNodeId.get(baseNode.data.nodeId) ?? []).map((event) => ({
        refName: event.refName,
        newValue: event.newValue,
        isAsync: event.isAsync,
      }));

      const nextStackedDecorators = baseNode.data.stackedDecorators.map((decorator) => {
        const decoratorSnapshot = snapshot?.nodes.get(decorator.nodeId);
        const decoratorSnapshotState = decoratorSnapshot?.state as SerializableState | undefined;
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
        && previousNode.data.isOnActivityPath === nextIsOnActivityPath
        && previousNode.data.isActivityTail === nextIsActivityTail
        && previousNode.selected === nextIsSelected
        && previousNode.data.displayStateIsStale === nextDisplayStateIsStale
        && shallowEqualState(previousNode.data.displayState, nextDisplayState)
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
          isOnActivityPath: nextIsOnActivityPath,
          isActivityTail: nextIsActivityTail,
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
      const nextIsOnActivityPathEdge = highlightedHostEdgeIds.has(baseEdge.id);

      const previousEdge = previousEdgesById.get(baseEdge.id);
      if (
        previousEdge
        && hasSameBaseEdgeShape(previousEdge, baseEdge)
        && previousEdge.data?.childResult === childResult
        && previousEdge.data?.isOnActivityPathEdge === nextIsOnActivityPathEdge
        && previousEdge.animated === nextAnimated
      ) {
        nextEdgesById.set(baseEdge.id, previousEdge);
        return previousEdge;
      }

      const nextEdge: Edge<BTEdgeData> = {
        ...baseEdge,
        data: { ...baseEdge.data, childResult, isOnActivityPathEdge: nextIsOnActivityPathEdge } as BTEdgeData,
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
  }, [
    baseNodes,
    baseEdges,
    inspector,
    tickId,
    selectedNodeId,
    activityPathNodeIds,
    activityTailNodeId,
    refEventsByNodeId,
    onSelectNode,
    tickGeneration,
  ]);
}

function getUtilityScores(
  displayState: SerializableState | undefined,
): number[] | undefined {
  if (displayState === undefined) return undefined;

  if (Array.isArray(displayState)) {
    return displayState.every((score) => typeof score === 'number')
      ? displayState
      : undefined;
  }

  if (!isStateRecord(displayState)) return undefined;

  const maybeScores = displayState.lastScores;
  if (!Array.isArray(maybeScores)) return undefined;
  if (!maybeScores.every((score) => typeof score === 'number')) return undefined;
  return maybeScores as number[];
}

function isStateRecord(state: SerializableState): state is Record<string, SerializableValue> {
  return typeof state === 'object' && state !== null && !Array.isArray(state);
}

function shallowEqualState(
  left: SerializableState | undefined,
  right: SerializableState | undefined,
): boolean {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!Object.is(left[i], right[i])) return false;
    }
    return true;
  }

  if (isStateRecord(left) && isStateRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) return false;
    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
      if (!Object.is(left[key], right[key])) return false;
    }
    return true;
  }
  return Object.is(left, right);
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
    if (!shallowEqualState(left[i].displayState, right[i].displayState)) return false;
    if (!shallowEqualRefEvents(left[i].refEvents, right[i].refEvents)) return false;
  }
  return true;
}
