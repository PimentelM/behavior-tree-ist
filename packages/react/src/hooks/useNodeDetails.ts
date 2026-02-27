import { useMemo } from 'react';
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
    const inspectorWithStateLookup = inspector as TreeInspector & {
      getLastDisplayState?: (nodeId: number, atOrBeforeTickId?: number) => unknown;
    };
    if (viewedTickId !== null) {
      const nodeSnap = inspector.getNodeAtTick(selectedNodeId, viewedTickId);
      if (nodeSnap) {
        currentResult = nodeSnap.result;
      }
      currentDisplayState = inspectorWithStateLookup.getLastDisplayState?.(selectedNodeId, viewedTickId) as Record<string, unknown> | undefined;
    }

    return {
      nodeId: selectedNodeId,
      name: indexed.name || indexed.defaultName,
      defaultName: indexed.defaultName,
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
    };
  }, [inspector, selectedNodeId, viewedTickId, tickGeneration]);
}
