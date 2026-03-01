import { useMemo } from 'react';
import { NodeFlags, hasFlag } from '@behavior-tree-ist/core';
import type { SerializableState, SerializableValue } from '@behavior-tree-ist/core';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { NodeDetailsData } from '../types';

export function useNodeDetails(
  inspector: TreeInspector,
  selectedNodeId: number | null,
  viewedTickId: number | null,
  tickGeneration: number,
): NodeDetailsData | null {
  return useMemo(() => {
    if (selectedNodeId === null) return null;

    const treeIndex = inspector.tree;
    if (!treeIndex) return null;

    const indexed = treeIndex.getById(selectedNodeId);
    if (!indexed) return null;
    const indexedMetadata = (indexed as typeof indexed & {
      metadata?: Readonly<Record<string, SerializableValue>>;
    }).metadata;

    const resultSummary = inspector.getNodeResultSummary(selectedNodeId);
    const rawHistory = inspector.getNodeHistory(selectedNodeId);

    // Get current state from snapshot
    let currentResult = null;
    let currentDisplayState: SerializableState | undefined;
    let currentDisplayStateIsStale = false;
    const inspectorWithStateLookup = inspector as TreeInspector & {
      getLastDisplayState?: (nodeId: number, atOrBeforeTickId?: number) => unknown;
    };
    if (viewedTickId !== null) {
      const nodeSnap = inspector.getNodeAtTick(selectedNodeId, viewedTickId);
      if (nodeSnap) {
        currentResult = nodeSnap.result;
      }
    }

    const stateLookupTick = viewedTickId ?? undefined;
    const selectedNodeSnapshot = viewedTickId === null
      ? undefined
      : inspector.getNodeAtTick(selectedNodeId, viewedTickId);

    currentDisplayState = inspectorWithStateLookup.getLastDisplayState?.(selectedNodeId, stateLookupTick) as SerializableState | undefined;
    if (currentDisplayState !== undefined && viewedTickId !== null) {
      currentDisplayStateIsStale = selectedNodeSnapshot === undefined || selectedNodeSnapshot.state === undefined;
    }

    if (currentDisplayState === undefined) {
      const syntheticState = getSyntheticUtilityDecoratorState(
        inspector,
        selectedNodeId,
        stateLookupTick,
      );
      if (syntheticState) {
        currentDisplayState = syntheticState.state;
        currentDisplayStateIsStale = syntheticState.isStale;
      }
    }

    const rawProfiling = inspector.getNodeProfilingData(selectedNodeId);
    const profilingData = rawProfiling ? { ...rawProfiling } : undefined;

    return {
      nodeId: selectedNodeId,
      name: indexed.name,
      defaultName: indexed.defaultName,
      activity: indexed.activity,
      flags: indexed.nodeFlags,
      path: treeIndex.getPathString(selectedNodeId),
      tags: indexed.tags,
      resultSummary,
      history: rawHistory.map((ev) => ({
        tickId: ev.tickId,
        result: ev.result,
        timestamp: ev.timestamp,
        state: ev.state,
      })),
      currentResult,
      currentDisplayState,
      currentDisplayStateIsStale,
      metadata: indexedMetadata,
      profilingData,
    };
  }, [inspector, selectedNodeId, viewedTickId, tickGeneration]);
}

function getSyntheticUtilityDecoratorState(
  inspector: TreeInspector,
  nodeId: number,
  atOrBeforeTickId: number | undefined,
): { state: SerializableState; isStale: boolean } | undefined {
  const treeIndex = inspector.tree;
  if (!treeIndex) return undefined;

  const node = treeIndex.getById(nodeId);
  if (!node) return undefined;
  if (!hasFlag(node.nodeFlags, NodeFlags.Decorator) || !hasFlag(node.nodeFlags, NodeFlags.Utility)) {
    return undefined;
  }

  const parentId = node.parentId;
  if (parentId === undefined) return undefined;

  const parent = treeIndex.getById(parentId);
  if (!parent) return undefined;
  if (!hasFlag(parent.nodeFlags, NodeFlags.Composite) || !hasFlag(parent.nodeFlags, NodeFlags.Utility)) {
    return undefined;
  }

  const childIndex = parent.childrenIds.indexOf(nodeId);
  if (childIndex < 0) return undefined;

  const inspectorWithStateLookup = inspector as TreeInspector & {
    getLastDisplayState?: (selectedNodeId: number, atOrBeforeTickId?: number) => unknown;
  };

  const parentState = inspectorWithStateLookup.getLastDisplayState?.(parentId, atOrBeforeTickId) as SerializableState | undefined;
  const lastScores = getUtilityScores(parentState);
  if (!lastScores) return undefined;

  const score = lastScores[childIndex];
  if (typeof score !== 'number') return undefined;

  const parentNodeSnapshot = atOrBeforeTickId === undefined
    ? undefined
    : inspector.getNodeAtTick(parentId, atOrBeforeTickId);

  return {
    state: { lastScore: score },
    isStale: atOrBeforeTickId !== undefined && (parentNodeSnapshot === undefined || parentNodeSnapshot.state === undefined),
  };
}

function getUtilityScores(displayState: SerializableState | undefined): number[] | undefined {
  if (displayState === undefined) return undefined;

  if (Array.isArray(displayState)) {
    return displayState.every((value) => typeof value === 'number')
      ? displayState
      : undefined;
  }

  if (!isStateRecord(displayState)) return undefined;
  const maybeScores = displayState.lastScores;
  if (!Array.isArray(maybeScores) || !maybeScores.every((value) => typeof value === 'number')) {
    return undefined;
  }
  return maybeScores as number[];
}

function isStateRecord(state: SerializableState): state is Record<string, SerializableValue> {
  return typeof state === 'object' && state !== null && !Array.isArray(state);
}
