import { useMemo } from 'react';
import type { TreeInspector, FlameGraphFrame, NodeProfilingData, TreeStats } from '@behavior-tree-ist/core/inspector';

export interface PerformanceData {
  frames: FlameGraphFrame[];
  hotNodes: NodeProfilingData[];
  stats: TreeStats;
}

export function usePerformanceData(
  inspector: TreeInspector,
  viewedTickId: number | null,
  tickGeneration: number,
  enabled: boolean,
): PerformanceData {
  return useMemo(() => {
    if (!enabled) {
      return { frames: [], hotNodes: [], stats: inspector.getStats() };
    }

    const frames = viewedTickId !== null
      ? inspector.getFlameGraphFrames(viewedTickId)
      : [];

    // Spread each object for React memo safety (same pattern as useNodeDetails)
    const hotNodes = inspector.getHotNodes().map((node) => ({ ...node }));
    const stats = inspector.getStats();

    return { frames, hotNodes, stats };
  }, [inspector, viewedTickId, tickGeneration, enabled]);
}
