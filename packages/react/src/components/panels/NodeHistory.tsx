import { memo, useCallback } from 'react';
import type { NodeResult } from '@behavior-tree-ist/core';
import { getResultColor } from '../../constants';

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

  // Show most recent first, limited to last 50
  const recentHistory = history.slice(-50).reverse();

  return (
    <div className="bt-history">
      <div className="bt-history__title">
        Tick History ({history.length} events)
      </div>
      <div className="bt-history__list">
        {recentHistory.map((entry) => (
          <HistoryEntryRow
            key={entry.tickId}
            entry={entry}
            isActive={entry.tickId === viewedTickId}
            onGoToTick={onGoToTick}
          />
        ))}
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
    <div
      className={`bt-history__entry ${isActive ? 'bt-history__entry--active' : ''}`}
      onClick={handleClick}
    >
      <span className="bt-history__tick-id">#{entry.tickId}</span>
      <span
        className="bt-history__result-dot"
        style={{ backgroundColor: getResultColor(entry.result) }}
      />
      <span className="bt-history__result-label">{entry.result}</span>
    </div>
  );
}

const HistoryEntryRow = memo(HistoryEntryRowInner);

export const NodeHistory = memo(NodeHistoryInner);
