import { memo, useMemo } from 'react';
import type { CpuTimelineEntry } from '@behavior-tree-ist/core/inspector';

interface CpuSparklineProps {
  entries: CpuTimelineEntry[];
  viewedTickId: number | null;
  oldestTickId: number | undefined;
  newestTickId: number | undefined;
}

function CpuSparklineInner({ entries, viewedTickId, oldestTickId, newestTickId }: CpuSparklineProps) {
  const { areaPath, cursorX } = useMemo(() => {
    if (entries.length < 2 || oldestTickId === undefined || newestTickId === undefined) {
      return { areaPath: null, cursorX: null };
    }

    const tickSpan = newestTickId - oldestTickId;
    if (tickSpan <= 0) return { areaPath: null, cursorX: null };

    let maxCpu = 0;
    for (const entry of entries) {
      if (entry.cpuTime > maxCpu) maxCpu = entry.cpuTime;
    }
    if (maxCpu <= 0) return { areaPath: null, cursorX: null };

    // Build SVG path in viewBox coordinates (0-100 x, 0-1 y)
    const points: string[] = [];
    for (const entry of entries) {
      const x = ((entry.tickId - oldestTickId) / tickSpan) * 100;
      const y = 1 - entry.cpuTime / maxCpu;
      points.push(`${x},${y}`);
    }

    const path = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L100,1 L0,1 Z`;

    let cursor: number | null = null;
    if (viewedTickId !== null) {
      cursor = ((viewedTickId - oldestTickId) / tickSpan) * 100;
    }

    return { areaPath: path, cursorX: cursor };
  }, [entries, viewedTickId, oldestTickId, newestTickId]);

  if (!areaPath) return null;

  return (
    <svg
      className="bt-timeline__sparkline"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
    >
      <path d={areaPath} className="bt-timeline__sparkline-area" />
      {cursorX !== null && (
        <line
          x1={cursorX}
          y1={0}
          x2={cursorX}
          y2={1}
          className="bt-timeline__sparkline-cursor"
        />
      )}
    </svg>
  );
}

export const CpuSparkline = memo(CpuSparklineInner);
