import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, UIEvent } from 'react';
import type { NodeResult } from '@behavior-tree-ist/core';
import { getResultColor } from '../../constants';

const HISTORY_PAGE_SIZE = 80;

interface HistoryEntry {
  tickId: number;
  result: NodeResult;
  timestamp: number;
  state?: Record<string, unknown>;
}

interface NodeHistoryProps {
  history: HistoryEntry[];
  viewedTickId: number | null;
  onGoToTick: (tickId: number) => void;
}

function NodeHistoryInner({ history, viewedTickId, onGoToTick }: NodeHistoryProps) {
  if (history.length === 0) return null;

  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);

  const sortedHistory = useMemo(() => history.slice().reverse(), [history]);
  const visibleHistory = useMemo(
    () => sortedHistory.slice(0, visibleCount),
    [sortedHistory, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
  }, [history.length]);

  useEffect(() => {
    if (viewedTickId === null) return;
    const index = sortedHistory.findIndex((entry) => entry.tickId === viewedTickId);
    if (index >= visibleCount) {
      setVisibleCount(index + HISTORY_PAGE_SIZE);
    }
  }, [viewedTickId, sortedHistory, visibleCount]);

  useEffect(() => {
    if (viewedTickId === null) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>(`[data-tick-id="${viewedTickId}"]`);
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [viewedTickId, visibleCount]);

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => {
      if (prev >= sortedHistory.length) return prev;
      return Math.min(prev + HISTORY_PAGE_SIZE, sortedHistory.length);
    });
  }, [sortedHistory.length]);

  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 40) {
      loadMore();
    }
  }, [loadMore]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (sortedHistory.length === 0) return;

    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();

    const currentIndex = viewedTickId === null
      ? 0
      : sortedHistory.findIndex((entry) => entry.tickId === viewedTickId);
    const fallbackIndex = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = event.key === 'ArrowDown'
      ? Math.min(fallbackIndex + 1, sortedHistory.length - 1)
      : Math.max(fallbackIndex - 1, 0);

    const nextEntry = sortedHistory[nextIndex];
    if (nextEntry) {
      if (nextIndex >= visibleCount - 2) {
        loadMore();
      }
      onGoToTick(nextEntry.tickId);
    }
  }, [sortedHistory, viewedTickId, onGoToTick, visibleCount, loadMore]);

  return (
    <div className="bt-history">
      <div className="bt-history__title">
        Tick History ({history.length} events)
      </div>
      <div
        ref={listRef}
        className="bt-history__list"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {visibleHistory.map((entry) => (
          <HistoryEntryRow
            key={entry.tickId}
            entry={entry}
            isActive={entry.tickId === viewedTickId}
            onGoToTick={onGoToTick}
          />
        ))}
        {visibleHistory.length < sortedHistory.length && (
          <button type="button" className="bt-history__load-more" onClick={loadMore}>
            Load older entries
          </button>
        )}
      </div>
    </div>
  );
}

interface HistoryEntryRowProps {
  entry: HistoryEntry;
  isActive: boolean;
  onGoToTick: (tickId: number) => void;
}

function HistoryEntryRowInner({ entry, isActive, onGoToTick }: HistoryEntryRowProps) {
  const handleClick = useCallback(() => {
    onGoToTick(entry.tickId);
  }, [entry.tickId, onGoToTick]);

  return (
    <button
      className={`bt-history__entry ${isActive ? 'bt-history__entry--active' : ''}`}
      onClick={handleClick}
      type="button"
      data-tick-id={entry.tickId}
    >
      <span className="bt-history__tick-id">#{entry.tickId}</span>
      <span
        className="bt-history__result-dot"
        style={{ backgroundColor: getResultColor(entry.result) }}
      />
      <span className="bt-history__result-label">{entry.result}</span>
    </button>
  );
}

const HistoryEntryRow = memo(HistoryEntryRowInner);

export const NodeHistory = memo(NodeHistoryInner);
