import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
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
  return useMemo(() => {
    if (tickId === null) {
      // No tick data yet — return base nodes with selection applied
      const nodes = baseNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          result: null,
          displayState: undefined,
          isSelected: n.data.nodeId === selectedNodeId,
        },
        selected: n.data.nodeId === selectedNodeId,
      }));
      return { nodes, edges: baseEdges };
    }

    const snapshot = inspector.getSnapshotAtTick(tickId);
    if (!snapshot) {
      const nodes = baseNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          result: null,
          displayState: undefined,
          isSelected: n.data.nodeId === selectedNodeId,
        },
        selected: n.data.nodeId === selectedNodeId,
      }));
      return { nodes, edges: baseEdges };
    }

    const nodes = baseNodes.map((n) => {
      const nodeSnap = snapshot.nodes.get(n.data.nodeId);
      return {
        ...n,
        data: {
          ...n.data,
          result: nodeSnap?.result ?? null,
          displayState: nodeSnap?.state,
          isSelected: n.data.nodeId === selectedNodeId,
        },
        selected: n.data.nodeId === selectedNodeId,
      };
    });

    // Build a lookup of child nodeId -> result for edge coloring
    const nodeResultMap = new Map<number, string>();
    for (const [nodeId, nodeSnap] of snapshot.nodes) {
      nodeResultMap.set(nodeId, nodeSnap.result);
    }

    const edges = baseEdges.map((e) => {
      const targetNodeId = parseInt(e.target, 10);
      const childResult = nodeResultMap.get(targetNodeId) ?? null;
      return {
        ...e,
        data: { ...e.data, childResult } as BTEdgeData,
        animated: childResult === 'Running',
      };
    });

    return { nodes, edges };
    // tickGeneration is used to trigger re-computation when new ticks arrive
  }, [baseNodes, baseEdges, inspector, tickId, selectedNodeId, tickGeneration]);
}
