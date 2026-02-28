import { memo, useCallback } from 'react';
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

interface TimelinePanelProps {
  controls: TimeTravelControls;
  displayTimeAsTimestamp: boolean;
  onTickChange?: (tickId: number) => void;
}

function TimelinePanelInner({
  controls,
  displayTimeAsTimestamp,
  onTickChange,
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
