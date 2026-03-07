import { useMemo } from 'react';
import type { TreeInspector, CpuTimelineEntry } from '@bt-studio/core/inspector';

export function useTimelineCpuData(
  inspector: TreeInspector,
  tickGeneration: number,
): CpuTimelineEntry[] {
  return useMemo(
    () => inspector.getCpuTimeline(),
    [inspector, tickGeneration],
  );
}
