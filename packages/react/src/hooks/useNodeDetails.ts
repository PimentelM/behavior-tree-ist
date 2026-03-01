import { useMemo } from 'react';
import { NodeFlags, hasFlag } from '@behavior-tree-ist/core';
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

    const resultSummary = inspector.getNodeResultSummary(selectedNodeId);
    const rawHistory = inspector.getNodeHistory(selectedNodeId);

    // Get current state from snapshot
    let currentResult = null;
    let currentDisplayState: Record<string, unknown> | undefined;
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

    currentDisplayState = inspectorWithStateLookup.getLastDisplayState?.(selectedNodeId, stateLookupTick) as Record<string, unknown> | undefined;
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
      profilingData,
    };
  }, [inspector, selectedNodeId, viewedTickId, tickGeneration]);
}

function getSyntheticUtilityDecoratorState(
  inspector: TreeInspector,
  nodeId: number,
  atOrBeforeTickId: number | undefined,
): { state: Record<string, unknown>; isStale: boolean } | undefined {
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

  const parentState = inspectorWithStateLookup.getLastDisplayState?.(parentId, atOrBeforeTickId) as Record<string, unknown> | undefined;
  if (!parentState) return undefined;

  const lastScores = parentState.lastScores;
  if (!Array.isArray(lastScores)) return undefined;

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
