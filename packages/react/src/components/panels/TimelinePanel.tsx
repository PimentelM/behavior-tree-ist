import { memo, useCallback, useMemo } from 'react';
import type { TimeTravelControls } from '../../types';

function formatNowValue(now: number | null, nowIsTimestamp: boolean | null): string | null {
  if (now === null) return null;
  if (!nowIsTimestamp) return `${now}`;

  const timestampMs = Math.abs(now) >= 1e12 ? now : now * 1000;
  const date = new Date(timestampMs);
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export interface TickCpuEntry {
  tickId: number;
  cpuTimeMs: number;
}

interface TimelinePanelProps {
  controls: TimeTravelControls;
  displayTimeAsTimestamp: boolean;
  onTickChange?: (tickId: number) => void;
  tickCpuTimes?: TickCpuEntry[];
}

function CpuSparkline({ entries, viewedTickId }: { entries: TickCpuEntry[]; viewedTickId: number | null }) {
  const svgContent = useMemo(() => {
    if (entries.length === 0) return null;

    const maxCpu = Math.max(...entries.map((e) => e.cpuTimeMs));
    if (maxCpu === 0) return null;

    const barWidth = 100 / entries.length;
    const bars = entries.map((entry, i) => {
      const heightPct = (entry.cpuTimeMs / maxCpu) * 100;
      const isCurrent = entry.tickId === viewedTickId;
      return (
        <rect
          key={entry.tickId}
          x={`${i * barWidth}%`}
          y={`${100 - heightPct}%`}
          width={`${Math.max(barWidth, 0.5)}%`}
          height={`${heightPct}%`}
          fill={isCurrent ? 'var(--bt-accent-color)' : 'var(--bt-text-muted)'}
          opacity={isCurrent ? 0.5 : 0.15}
        />
      );
    });

    return bars;
  }, [entries, viewedTickId]);

  if (!svgContent) return null;

  return (
    <svg
      className="bt-timeline__sparkline"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {svgContent}
    </svg>
  );
}

function TimelinePanelInner({
  controls,
  displayTimeAsTimestamp,
  onTickChange,
  tickCpuTimes,
}: TimelinePanelProps) {
  const {
    mode,
    viewedTickId,
    viewedNow,
    totalTicks,
    oldestTickId,
    newestTickId,
    goToTick,
    stepBack,
    stepForward,
    jumpToLive,
  } = controls;

  const hasTicks = oldestTickId !== undefined && newestTickId !== undefined;
  const formattedNow = formatNowValue(viewedNow, displayTimeAsTimestamp);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const tickId = parseInt(e.target.value, 10);
      goToTick(tickId);
      onTickChange?.(tickId);
    },
    [goToTick, onTickChange],
  );

  const handleStepBack = useCallback(() => {
    stepBack();
  }, [stepBack]);

  const handleStepForward = useCallback(() => {
    stepForward();
  }, [stepForward]);

  const handleJumpToLive = useCallback(() => {
    jumpToLive();
    if (newestTickId !== undefined) {
      onTickChange?.(newestTickId);
    }
  }, [jumpToLive, newestTickId, onTickChange]);

  const hasCpuData = tickCpuTimes && tickCpuTimes.length > 0;

  return (
    <div className="bt-timeline">
      <span
        className={`bt-timeline__mode-badge bt-timeline__mode-badge--${mode}`}
      >
        {mode}
      </span>

      {mode === 'paused' && (
        <button
          className="bt-timeline__btn bt-timeline__btn--exit"
          onClick={handleJumpToLive}
          type="button"
          title="Exit time travel (Esc)"
        >
          Exit Time Travel
        </button>
      )}

      <div className="bt-timeline__controls">
        <button
          className="bt-timeline__btn"
          onClick={handleStepBack}
          disabled={!hasTicks || viewedTickId === oldestTickId}
          title="Step back (Left Arrow)"
          type="button"
        >
          &#9664;
        </button>
        <button
          className="bt-timeline__btn"
          onClick={handleStepForward}
          disabled={!hasTicks || viewedTickId === newestTickId}
          title="Step forward (Right Arrow)"
          type="button"
        >
          &#9654;
        </button>
        <button
          className={`bt-timeline__btn bt-timeline__btn--live ${
            mode === 'live' ? 'bt-timeline__btn--live-active' : ''
          }`}
          onClick={handleJumpToLive}
          disabled={mode === 'live'}
          title="Jump to live"
          type="button"
        >
          LIVE
        </button>
      </div>

      <div className="bt-timeline__scrubber">
        {hasCpuData ? (
          <CpuSparkline entries={tickCpuTimes} viewedTickId={viewedTickId} />
        ) : (
          <span className="bt-timeline__sparkline-hint">Enable profiling for CPU timeline</span>
        )}
        {hasTicks ? (
          <input
            type="range"
            min={oldestTickId}
            max={newestTickId}
            value={viewedTickId ?? newestTickId}
            onChange={handleScrub}
            step={1}
          />
        ) : (
          <input type="range" min={0} max={0} value={0} disabled />
        )}
      </div>

      <span className="bt-timeline__info">
        {viewedTickId !== null ? `Tick #${viewedTickId}` : 'No ticks'}
        {formattedNow !== null ? ` · time ${formattedNow}` : ''}{' '}
        / {totalTicks} total
      </span>

    </div>
  );
}

export const TimelinePanel = memo(TimelinePanelInner);
