import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { RefChangeEvent } from '@bt-studio/core';

interface RefTracesPanelProps {
  events: RefChangeEvent[];
  viewedTickId: number | null;
  onGoToTick: (tickId: number) => void;
  onFocusActorNode: (nodeId: number) => void;
}

const ALL_REFS_FILTER = '__all_refs__';

function RefTracesPanelInner({
  events,
  viewedTickId,
  onGoToTick,
  onFocusActorNode,
}: RefTracesPanelProps) {
  const [selectedRefName, setSelectedRefName] = useState<string>(ALL_REFS_FILTER);
  const [scope, setScope] = useState<'all' | 'current'>('all');

  const knownRefNames = useMemo(() => {
    const names = new Set<string>();
    for (const event of events) {
      names.add(formatRefName(event.refName));
    }
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [events]);

  useEffect(() => {
    if (selectedRefName === ALL_REFS_FILTER) return;
    if (knownRefNames.includes(selectedRefName)) return;
    setSelectedRefName(ALL_REFS_FILTER);
  }, [knownRefNames, selectedRefName]);

  const latestStates = useMemo(() => {
    const latestByRef = new Map<string, RefChangeEvent>();
    const eventsUpToTick = viewedTickId !== null
      ? events.filter((event) => event.tickId <= viewedTickId)
      : events;
    for (const event of eventsUpToTick) {
      latestByRef.set(formatRefName(event.refName), event);
    }

    return Array.from(latestByRef.entries())
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(([refName, event]) => ({
        refName,
        event,
        isStale: viewedTickId !== null && event.tickId < viewedTickId,
      }));
  }, [events, viewedTickId]);

  const groupedLatestStates = useMemo(() => {
    const groupMap = new Map<string | null, typeof latestStates>();
    for (const entry of latestStates) {
      const prefix = getRefPrefix(entry.refName);
      const existing = groupMap.get(prefix);
      if (existing) {
        existing.push(entry);
      } else {
        groupMap.set(prefix, [entry]);
      }
    }
    // Ungrouped (null prefix) first, then sorted groups
    const result: Array<{ prefix: string | null; entries: typeof latestStates }> = [];
    const ungrouped = groupMap.get(null);
    if (ungrouped) result.push({ prefix: null, entries: ungrouped });
    for (const [prefix, entries] of groupMap) {
      if (prefix !== null) result.push({ prefix, entries });
    }
    return result;
  }, [latestStates]);

  const visibleEvents = useMemo(() => {
    let filtered = events;

    if (selectedRefName !== ALL_REFS_FILTER) {
      filtered = filtered.filter((event) => formatRefName(event.refName) === selectedRefName);
    }

    if (scope === 'current') {
      filtered = viewedTickId === null
        ? []
        : filtered.filter((event) => event.tickId === viewedTickId);
    }

    return filtered.slice(-200).reverse();
  }, [events, selectedRefName, scope, viewedTickId]);

  return (
    <div className="bt-ref-traces">
      <div className="bt-ref-traces__controls">
        <label className="bt-ref-traces__control">
          <span>Ref</span>
          <select
            className="bt-ref-traces__select"
            value={selectedRefName}
            onChange={(event) => { setSelectedRefName(event.target.value); }}
          >
            <option value={ALL_REFS_FILTER}>All refs</option>
            {knownRefNames.map((refName) => (
              <option key={refName} value={refName}>{refName}</option>
            ))}
          </select>
        </label>

        <div className="bt-ref-traces__scope-toggle" aria-label="Event scope">
          <button
            type="button"
            className={`bt-ref-traces__scope-btn ${scope === 'all' ? 'bt-ref-traces__scope-btn--active' : ''}`}
            onClick={() => { setScope('all'); }}
          >
            All ticks
          </button>
          <button
            type="button"
            className={`bt-ref-traces__scope-btn ${scope === 'current' ? 'bt-ref-traces__scope-btn--active' : ''}`}
            onClick={() => { setScope('current'); }}
          >
            Current tick
          </button>
        </div>
      </div>

      <section className="bt-ref-traces__section">
        <h3 className="bt-ref-traces__title">Last known ref states</h3>
        {latestStates.length === 0 ? (
          <div className="bt-ref-traces__empty">No refs have been mutated yet</div>
        ) : (
          <div className="bt-ref-traces__state-list">
            {groupedLatestStates.map(({ prefix, entries }) => (
              <div key={prefix ?? '__ungrouped__'} className={prefix !== null ? 'bt-ref-traces__group' : undefined}>
                {prefix !== null && (
                  <div className="bt-ref-traces__group-header">{prefix}</div>
                )}
                {entries.map(({ refName, event, isStale }) => (
                  <button
                    key={`latest-${refName}`}
                    type="button"
                    className="bt-ref-traces__state-entry"
                    onClick={() => {
                      onGoToTick(event.tickId);
                      if (event.nodeId !== undefined) {
                        onFocusActorNode(event.nodeId);
                      }
                    }}
                  >
                    <span
                      className={`bt-ref-traces__stale-dot ${isStale ? 'bt-ref-traces__stale-dot--stale' : 'bt-ref-traces__stale-dot--fresh'}`}
                      aria-label={isStale ? 'stale' : 'fresh'}
                    />
                    <span className="bt-ref-traces__state-name">
                      {prefix !== null ? getRefSuffix(refName) : refName}
                    </span>
                    <span className="bt-ref-traces__tick">tick #{event.tickId}</span>
                    <span className="bt-ref-traces__value">{formatEventValue(event)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bt-ref-traces__section">
        <h3 className="bt-ref-traces__title">Ref event timeline</h3>
        {visibleEvents.length === 0 ? (
          <div className="bt-ref-traces__empty">
            No matching ref events for this filter
          </div>
        ) : (
          <div className="bt-ref-traces__event-list">
            {visibleEvents.map((event, i) => (
              <RefTraceEntry
                key={`${event.tickId}-${event.refName ?? 'ref'}-${event.nodeId ?? 'none'}-${i}`}
                event={event}
                onGoToTick={onGoToTick}
                onFocusActorNode={onFocusActorNode}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface RefTraceEntryProps {
  event: RefChangeEvent;
  onGoToTick: (tickId: number) => void;
  onFocusActorNode: (nodeId: number) => void;
}

function RefTraceEntryInner({ event, onGoToTick, onFocusActorNode }: RefTraceEntryProps) {
  const handleClick = useCallback(() => {
    onGoToTick(event.tickId);
    if (event.nodeId !== undefined) {
      onFocusActorNode(event.nodeId);
    }
  }, [event.tickId, event.nodeId, onGoToTick, onFocusActorNode]);

  return (
    <button className="bt-ref-traces__entry" onClick={handleClick} type="button">
      <div className="bt-ref-traces__entry-header">
        <span className="bt-ref-traces__ref-name">
          {event.refName ?? '(unnamed)'}
        </span>
        <span className="bt-ref-traces__tick">tick #{event.tickId}</span>
        {event.nodeId !== undefined && (
          <span className="bt-ref-traces__actor-badge">node #{event.nodeId}</span>
        )}
        {event.isAsync && (
          <span className="bt-ref-traces__async-badge">async</span>
        )}
      </div>
      <div className="bt-ref-traces__value">
        {formatEventValue(event)}
      </div>
    </button>
  );
}

function formatRefValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value);
  }
}

function formatEventValue(event: RefChangeEvent): string {
  if (event.displayValue !== undefined) return event.displayValue;
  return formatRefValue(event.newValue);
}

function formatRefName(refName: string | undefined): string {
  return refName ?? '(unnamed)';
}

function getRefPrefix(refName: string): string | null {
  const dotIndex = refName.indexOf('.');
  return dotIndex === -1 ? null : refName.slice(0, dotIndex);
}

function getRefSuffix(refName: string): string {
  const dotIndex = refName.indexOf('.');
  return dotIndex === -1 ? refName : refName.slice(dotIndex + 1);
}

const RefTraceEntry = memo(RefTraceEntryInner);

export const RefTracesPanel = memo(RefTracesPanelInner);
