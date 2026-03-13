import { useState, useRef, useCallback } from 'react';

interface WindowRangeTrimmerProps {
  minTickId: number;
  maxTickId: number;
  totalCount: number;
  defaultFrom?: number;
  defaultTo?: number;
  isLoading?: boolean;
  onApply: (from: number, to: number) => void;
  onClose: () => void;
}

function fracToTick(frac: number, min: number, max: number): number {
  return Math.round(min + frac * (max - min));
}

function tickToFrac(tick: number, min: number, max: number): number {
  if (max === min) return 0;
  return (tick - min) / (max - min);
}

export function WindowRangeTrimmer({
  minTickId,
  maxTickId,
  totalCount,
  defaultFrom,
  defaultTo,
  isLoading,
  onApply,
  onClose,
}: WindowRangeTrimmerProps) {
  const totalSpan = maxTickId - minTickId;

  const [fromFrac, setFromFrac] = useState(() =>
    defaultFrom !== undefined ? tickToFrac(defaultFrom, minTickId, maxTickId) : 0,
  );
  const [toFrac, setToFrac] = useState(() =>
    defaultTo !== undefined ? tickToFrac(defaultTo, minTickId, maxTickId) : 1,
  );

  const trackRef = useRef<HTMLDivElement>(null);

  const getFracFromPointer = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleLeftPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const frac = getFracFromPointer(ev.clientX);
        setFromFrac(Math.min(frac, toFrac - 0.001));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [getFracFromPointer, toFrac],
  );

  const handleRightPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const frac = getFracFromPointer(ev.clientX);
        setToFrac(Math.max(frac, fromFrac + 0.001));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [getFracFromPointer, fromFrac],
  );

  const handleSelectionPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const startFrac = getFracFromPointer(e.clientX);
      const startFrom = fromFrac;
      const startTo = toFrac;
      const width = startTo - startFrom;
      const move = (ev: PointerEvent) => {
        const delta = getFracFromPointer(ev.clientX) - startFrac;
        const newFrom = Math.max(0, Math.min(1 - width, startFrom + delta));
        setFromFrac(newFrom);
        setToFrac(newFrom + width);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [getFracFromPointer, fromFrac, toFrac],
  );

  const fromTick = fracToTick(fromFrac, minTickId, maxTickId);
  const toTick = fracToTick(toFrac, minTickId, maxTickId);
  const rangeCount = toTick - fromTick;
  const rangePct = totalSpan > 0 ? ((rangeCount / totalSpan) * 100).toFixed(1) : '0.0';

  const handleApply = useCallback(() => {
    onApply(fromTick, toTick);
  }, [onApply, fromTick, toTick]);

  return (
    <div className="bt-range-trimmer" role="dialog" aria-label="Select window range">
      <div className="bt-range-trimmer__header">
        <span className="bt-range-trimmer__title">Select Window</span>
        <button
          type="button"
          className="bt-range-trimmer__close"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="bt-range-trimmer__meta">
        {totalCount.toLocaleString()} ticks on server · ticks #{minTickId.toLocaleString()}–#{maxTickId.toLocaleString()}
      </div>

      <div className="bt-range-trimmer__track-wrap">
        <div className="bt-range-trimmer__track" ref={trackRef}>
          <div className="bt-range-trimmer__rail" />
          <div
            className="bt-range-trimmer__selection"
            style={{ left: `${fromFrac * 100}%`, width: `${(toFrac - fromFrac) * 100}%` }}
            onPointerDown={handleSelectionPointerDown}
          />
          <div
            className="bt-range-trimmer__handle bt-range-trimmer__handle--left"
            style={{ left: `${fromFrac * 100}%` }}
            onPointerDown={handleLeftPointerDown}
            role="slider"
            aria-label="Range start"
            aria-valuenow={fromTick}
            aria-valuemin={minTickId}
            aria-valuemax={maxTickId}
            tabIndex={0}
          />
          <div
            className="bt-range-trimmer__handle bt-range-trimmer__handle--right"
            style={{ left: `${toFrac * 100}%` }}
            onPointerDown={handleRightPointerDown}
            role="slider"
            aria-label="Range end"
            aria-valuenow={toTick}
            aria-valuemin={minTickId}
            aria-valuemax={maxTickId}
            tabIndex={0}
          />
        </div>
      </div>

      <div className="bt-range-trimmer__info">
        <span>
          <span className="bt-range-trimmer__info-label">From</span>{' '}
          #{fromTick.toLocaleString()}
        </span>
        <span>
          <span className="bt-range-trimmer__info-label">To</span>{' '}
          #{toTick.toLocaleString()}
        </span>
        <span className="bt-range-trimmer__info-range">
          {rangeCount.toLocaleString()} ticks ({rangePct}%)
        </span>
      </div>

      <div className="bt-range-trimmer__actions">
        <button
          type="button"
          className="bt-range-trimmer__btn bt-range-trimmer__btn--cancel"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className="bt-range-trimmer__btn bt-range-trimmer__btn--apply"
          onClick={handleApply}
          disabled={isLoading}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
