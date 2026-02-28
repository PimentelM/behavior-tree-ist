import { useMemo } from 'react';
import type { TreeInspector, FlameGraphFrame, NodeProfilingData } from '@behavior-tree-ist/core/inspector';

export interface PerformanceData {
  frames: FlameGraphFrame[];
  hotNodes: NodeProfilingData[];
}

export function usePerformanceData(
  inspector: TreeInspector,
  viewedTickId: number | null,
  tickGeneration: number,
): PerformanceData {
  return useMemo(() => {
    const frames = viewedTickId !== null
      ? inspector.getFlameGraphFrames(viewedTickId)
      : [];

    // Spread each object for React memo safety (same pattern as useNodeDetails)
    const hotNodes = inspector.getHotNodes().map((node) => ({ ...node }));

    return { frames, hotNodes };
  }, [inspector, viewedTickId, tickGeneration]);
}
