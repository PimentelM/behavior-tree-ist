import { memo, useCallback, useState } from 'react';
import type { CpuTimelineEntry } from '@bt-studio/core/inspector';
import type { TimeTravelControls, StudioTickBounds } from '../../types';
import { formatNowValue } from '../../utils/format';
import { CpuSparkline } from './CpuSparkline';
import { ByteSparkline, type ByteSparklineSample } from './ByteSparkline';
import { WindowRangeTrimmer } from './WindowRangeTrimmer';

interface TimelinePanelProps {
  controls: TimeTravelControls;
  cpuTimeline: CpuTimelineEntry[];
  byteTimeline?: ByteSparklineSample[];
  displayTimeAsTimestamp: boolean;
  onTickChange?: (tickId: number) => void;
  onSelectRange?: (from: number, to: number) => void;
}

function TimelinePanelInner({
  controls,
  cpuTimeline,
  byteTimeline,
  displayTimeAsTimestamp,
  onTickChange,
  onSelectRange,
}: TimelinePanelProps) {
  const {
    mode,
    viewedTickId,
    viewedNow,
    totalTicks,
    oldestTickId,
    newestTickId,
    serverBounds,
    isLoading,
    goToTick,
    stepBack,
    stepForward,
    jumpToLive,
  } = controls;

  const hasTicks = oldestTickId !== undefined && newestTickId !== undefined;

  // Scrubber spans the loaded window only; window selector spans full server bounds
  const scrubberMin = oldestTickId;
  const scrubberMax = newestTickId;
  const hasScrubberRange = scrubberMin !== undefined && scrubberMax !== undefined;

  const [trimmerOpen, setTrimmerOpen] = useState(false);
  const [frozenBounds, setFrozenBounds] = useState<StudioTickBounds | null>(null);
  const showWindowSelector = serverBounds !== null && onSelectRange !== undefined;

  const formattedNow = formatNowValue(viewedNow, displayTimeAsTimestamp);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const tickId = parseInt(e.target.value, 10);
      goToTick(tickId);
      onTickChange?.(tickId);
    },
    [goToTick, onTickChange],
  );

  const handleJumpToLive = useCallback(() => {
    jumpToLive();
    if (newestTickId !== undefined) {
      onTickChange?.(newestTickId);
    }
  }, [jumpToLive, newestTickId, onTickChange]);

  const handleToggleTrimmer = useCallback(() => {
    setTrimmerOpen((prev) => {
      if (!prev) setFrozenBounds(serverBounds);
      else setFrozenBounds(null);
      return !prev;
    });
  }, [serverBounds]);

  const handleTrimmerClose = useCallback(() => {
    setTrimmerOpen(false);
    setFrozenBounds(null);
  }, []);

  const handleTrimmerApply = useCallback(
    (from: number, to: number) => {
      onSelectRange?.(from, to);
      controls.navigateToTick(from);
      setTrimmerOpen(false);
      setFrozenBounds(null);
    },
    [onSelectRange, controls],
  );

  const serverTotal = serverBounds?.totalCount;
  const showWindowInfo = serverBounds !== null && serverTotal !== undefined;

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
          onClick={stepBack}
          disabled={isLoading || !hasTicks || viewedTickId === oldestTickId}
          title="Step back (Left Arrow)"
          type="button"
        >
          &#9664;
        </button>
        <button
          className="bt-timeline__btn"
          onClick={stepForward}
          disabled={isLoading || !hasTicks || viewedTickId === newestTickId}
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
        {isLoading && (
          <span className="bt-timeline__loading" title="Loading ticks…">
            ⌛
          </span>
        )}
      </div>

      <div className="bt-timeline__scrubber">
        <CpuSparkline
          entries={cpuTimeline}
          viewedTickId={viewedTickId}
        />
        {byteTimeline && byteTimeline.length > 0 && (
          <ByteSparkline
            samples={byteTimeline}
            viewedTickId={viewedTickId}
          />
        )}
        {hasScrubberRange ? (
          <input
            type="range"
            min={scrubberMin}
            max={scrubberMax}
            value={viewedTickId ?? scrubberMax}
            onChange={handleScrub}
            disabled={isLoading}
            step={1}
          />
        ) : (
          <input type="range" min={0} max={0} value={0} disabled />
        )}
        {showWindowSelector && (
          <div className="bt-timeline__window-selector">
            <button
              type="button"
              className="bt-timeline__window-btn"
              onClick={handleToggleTrimmer}
              disabled={isLoading}
              title="Select tick window range"
            >
              Window
            </button>
            {trimmerOpen && (
              <WindowRangeTrimmer
                minTickId={(frozenBounds ?? serverBounds)!.minTickId}
                maxTickId={(frozenBounds ?? serverBounds)!.maxTickId}
                totalCount={(frozenBounds ?? serverBounds)!.totalCount}
                defaultFrom={oldestTickId}
                defaultTo={newestTickId}
                isLoading={isLoading}
                onApply={handleTrimmerApply}
                onClose={handleTrimmerClose}
              />
            )}
          </div>
        )}
      </div>

      <span className="bt-timeline__info">
        {viewedTickId !== null ? `Tick #${viewedTickId}` : 'No ticks'}
        {formattedNow !== null ? ` · time ${formattedNow}` : ''}{' '}
        {showWindowInfo
          ? `· Loaded: ${totalTicks.toLocaleString()}/${serverTotal!.toLocaleString()} ticks`
          : `/ ${totalTicks} total`}
      </span>

    </div>
  );
}

export const TimelinePanel = memo(TimelinePanelInner);
