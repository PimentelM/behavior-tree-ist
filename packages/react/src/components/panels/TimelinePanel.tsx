import { memo, useCallback } from 'react';
import type { TimeTravelControls } from '../../types';

interface TimelinePanelProps {
  controls: TimeTravelControls;
  onTickChange?: (tickId: number) => void;
}

function TimelinePanelInner({ controls, onTickChange }: TimelinePanelProps) {
  const {
    mode,
    viewedTickId,
    totalTicks,
    oldestTickId,
    newestTickId,
    goToTick,
    stepBack,
    stepForward,
    jumpToLive,
  } = controls;

  const hasTicks = oldestTickId !== undefined && newestTickId !== undefined;

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

      <div className="bt-timeline__controls">
        <button
          className="bt-timeline__btn"
          onClick={handleStepBack}
          disabled={!hasTicks || viewedTickId === oldestTickId}
          title="Step back"
        >
          &#9664;
        </button>
        <button
          className="bt-timeline__btn"
          onClick={handleStepForward}
          disabled={!hasTicks || viewedTickId === newestTickId}
          title="Step forward"
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
        {viewedTickId !== null ? `Tick #${viewedTickId}` : 'No ticks'}{' '}
        / {totalTicks} total
      </span>
    </div>
  );
}

export const TimelinePanel = memo(TimelinePanelInner);
