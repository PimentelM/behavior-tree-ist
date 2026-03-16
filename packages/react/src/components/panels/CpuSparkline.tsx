import { memo, useMemo } from 'react';
import type { CpuTimelineEntry } from '@bt-studio/core/inspector';

interface CpuSparklineProps {
  entries: CpuTimelineEntry[];
  viewedTickId: number | null;
}

function CpuSparklineInner({ entries, viewedTickId }: CpuSparklineProps) {
  const { areaPath, tickSpan, firstTickId } = useMemo(() => {
    if (entries.length < 2) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    const first = (entries[0] as (typeof entries)[number]).tickId;
    const last = (entries[entries.length - 1] as (typeof entries)[number]).tickId;
    const span = last - first;
    if (span <= 0) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    let maxCpu = 0;
    for (const entry of entries) {
      if (entry.cpuTime > maxCpu) maxCpu = entry.cpuTime;
    }
    if (maxCpu <= 0) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    // Build SVG path in viewBox coordinates (0-100 x, 0-1 y)
    const points: string[] = [];
    for (const entry of entries) {
      const x = ((entry.tickId - first) / span) * 100;
      const y = 1 - entry.cpuTime / maxCpu;
      points.push(`${x},${y}`);
    }

    const path = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L100,1 L0,1 Z`;
    return { areaPath: path, tickSpan: span, firstTickId: first };
  }, [entries]);

  const cursorX = useMemo(() => {
    if (viewedTickId === null || tickSpan <= 0) return null;
    return ((viewedTickId - firstTickId) / tickSpan) * 100;
  }, [viewedTickId, tickSpan, firstTickId]);

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
