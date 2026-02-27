import { memo, useCallback } from 'react';
import type { RefChangeEvent } from '@behavior-tree-ist/core';

interface RefTracesPanelProps {
  events: RefChangeEvent[];
  onGoToTick: (tickId: number) => void;
}

function RefTracesPanelInner({ events, onGoToTick }: RefTracesPanelProps) {
  if (events.length === 0) {
    return (
      <div className="bt-ref-traces">
        <div className="bt-ref-traces__empty">
          No unattributed ref mutation events in this tick
        </div>
      </div>
    );
  }

  // Show most recent first, limited to last 100
  const recentEvents = events.slice(-100).reverse();

  return (
    <div className="bt-ref-traces">
      {recentEvents.map((event, i) => (
        <RefTraceEntry key={i} event={event} onGoToTick={onGoToTick} />
      ))}
    </div>
  );
}

interface RefTraceEntryProps {
  event: RefChangeEvent;
  onGoToTick: (tickId: number) => void;
}

function RefTraceEntryInner({ event, onGoToTick }: RefTraceEntryProps) {
  const handleClick = useCallback(() => {
    onGoToTick(event.tickId);
  }, [event.tickId, onGoToTick]);

  return (
    <div className="bt-ref-traces__entry" onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className="bt-ref-traces__entry-header">
        <span className="bt-ref-traces__ref-name">
          {event.refName ?? '(unnamed)'}
        </span>
        <span className="bt-ref-traces__tick">tick #{event.tickId}</span>
        {event.isAsync && (
          <span className="bt-ref-traces__async-badge">async</span>
        )}
      </div>
      <div className="bt-ref-traces__value">
        {formatRefValue(event.newValue)}
      </div>
    </div>
  );
}

function formatRefValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const RefTraceEntry = memo(RefTraceEntryInner);

export const RefTracesPanel = memo(RefTracesPanelInner);
