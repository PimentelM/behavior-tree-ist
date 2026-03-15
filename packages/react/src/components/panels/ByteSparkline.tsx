import { memo, useMemo } from 'react';

export interface ByteSparklineSample {
  tickId: number;
  bytes: number;
}

interface ByteSparklineProps {
  samples: ByteSparklineSample[];
  viewedTickId: number | null;
}

function ByteSparklineInner({ samples, viewedTickId }: ByteSparklineProps) {
  const { areaPath, tickSpan, firstTickId } = useMemo(() => {
    if (samples.length < 2) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    const first = samples[0].tickId;
    const last = samples[samples.length - 1].tickId;
    const span = last - first;
    if (span <= 0) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    let maxBytes = 0;
    for (const sample of samples) {
      if (sample.bytes > maxBytes) maxBytes = sample.bytes;
    }
    if (maxBytes <= 0) return { areaPath: null, tickSpan: 0, firstTickId: 0 };

    const points: string[] = [];
    for (const sample of samples) {
      const x = ((sample.tickId - first) / span) * 100;
      const y = 1 - sample.bytes / maxBytes;
      points.push(`${x},${y}`);
    }

    const path = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(' ')} L100,1 L0,1 Z`;
    return { areaPath: path, tickSpan: span, firstTickId: first };
  }, [samples]);

  const cursorX = useMemo(() => {
    if (viewedTickId === null || tickSpan <= 0) return null;
    return ((viewedTickId - firstTickId) / tickSpan) * 100;
  }, [viewedTickId, tickSpan, firstTickId]);

  if (!areaPath) return null;

  return (
    <svg
      className="bt-timeline__sparkline bt-timeline__sparkline--bytes"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
    >
      <path d={areaPath} className="bt-timeline__sparkline-area bt-timeline__sparkline-area--bytes" />
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

export const ByteSparkline = memo(ByteSparklineInner);
