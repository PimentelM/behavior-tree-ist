import { useMemo } from 'react';
import type { TreeInspector, CpuTimelineEntry } from '@behavior-tree-ist/core/inspector';

export function useTimelineCpuData(
  inspector: TreeInspector,
  tickGeneration: number,
): CpuTimelineEntry[] {
  return useMemo(
    () => inspector.getCpuTimeline(),
    [inspector, tickGeneration],
  );
}
