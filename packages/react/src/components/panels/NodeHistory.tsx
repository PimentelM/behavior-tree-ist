import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, UIEvent } from 'react';
import type { NodeResult, SerializableState } from '@behavior-tree-ist/core';
import { getResultColor } from '../../constants';

const HISTORY_PAGE_SIZE = 80;

interface HistoryEntry {
  tickId: number;
  result: NodeResult;
  timestamp: number;
  state?: SerializableState;
}

interface HistoryGroup {
  result: NodeResult;
  entries: HistoryEntry[];
}

interface NodeHistoryProps {
  history: HistoryEntry[];
  viewedTickId: number | null;
  onGoToTick: (tickId: number) => void;
}

function computeGroups(sorted: HistoryEntry[]): HistoryGroup[] {
  if (sorted.length === 0) return [];
  const groups: HistoryGroup[] = [];
  let current: HistoryGroup = { result: sorted[0].result, entries: [sorted[0]] };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].result === current.result) {
      current.entries.push(sorted[i]);
    } else {
      groups.push(current);
      current = { result: sorted[i].result, entries: [sorted[i]] };
    }
  }
  groups.push(current);
  return groups;
}

function findGroupIndexForTick(groups: HistoryGroup[], tickId: number): number {
  for (let gi = 0; gi < groups.length; gi++) {
    if (groups[gi].entries.some((e) => e.tickId === tickId)) return gi;
  }
  return -1;
}

function isGroupCollapsed(group: HistoryGroup, groupIndex: number, expandedGroups: Set<number>): boolean {
  return group.entries.length >= 3 && !expandedGroups.has(groupIndex);
}

function NodeHistoryInner({ history, viewedTickId, onGoToTick }: NodeHistoryProps) {
  const [visibleCount, setVisibleCount] = useState(HISTORY_PAGE_SIZE);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement | null>(null);

  const sortedHistory = useMemo(() => history.slice().reverse(), [history]);

  const groups = useMemo(() => computeGroups(sortedHistory), [sortedHistory]);

  const changedIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < sortedHistory.length - 1; i++) {
      if (sortedHistory[i].result !== sortedHistory[i + 1].result) {
        set.add(sortedHistory[i].tickId);
      }
    }
    return set;
  }, [sortedHistory]);

  // Build visible items from groups respecting visibleCount (based on total entry count)
  const { visibleItems, totalEntryCount } = useMemo(() => {
    const items: Array<
      | { type: 'entry'; entry: HistoryEntry; changed: boolean }
      | { type: 'group'; group: HistoryGroup; groupIndex: number }
    > = [];
    let entryCount = 0;

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const isCollapsible = group.entries.length >= 3;
      const isExpanded = expandedGroups.has(gi);

      if (!isCollapsible || isExpanded) {
        for (const entry of group.entries) {
          if (entryCount >= visibleCount) break;
          items.push({
            type: 'entry',
            entry,
            changed: changedIndices.has(entry.tickId),
          });
          entryCount++;
        }
      } else {
        // Collapsed group header — counts as 1 toward pagination
        if (entryCount >= visibleCount) break;
        items.push({ type: 'group', group, groupIndex: gi });
        entryCount += 1;
      }

      if (entryCount >= visibleCount) break;
    }

    return { visibleItems: items, totalEntryCount: sortedHistory.length };
  }, [groups, visibleCount, expandedGroups, changedIndices, sortedHistory.length]);

  const toggleGroup = useCallback((groupIndex: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setVisibleCount(HISTORY_PAGE_SIZE);
    setExpandedGroups(new Set());
  }, [history.length]);

  useEffect(() => {
    if (viewedTickId === null) return;
    const index = sortedHistory.findIndex((entry) => entry.tickId === viewedTickId);
    if (index >= visibleCount) {
      setVisibleCount(index + HISTORY_PAGE_SIZE);
    }
  }, [viewedTickId, sortedHistory, visibleCount]);

  // Auto-expand collapsed group when viewedTickId lands inside it (e.g. time-travel slider)
  useEffect(() => {
    if (viewedTickId === null) return;
    const gi = findGroupIndexForTick(groups, viewedTickId);
    if (gi >= 0 && isGroupCollapsed(groups[gi], gi, expandedGroups)) {
      setExpandedGroups((prev) => new Set(prev).add(gi));
    }
  }, [viewedTickId, groups, expandedGroups]);

  useEffect(() => {
    if (viewedTickId === null) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLButtonElement>(`[data-tick-id="${viewedTickId}"]`);
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [viewedTickId, visibleCount, expandedGroups]);

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
      const gi = findGroupIndexForTick(groups, nextEntry.tickId);
      if (gi >= 0 && isGroupCollapsed(groups[gi], gi, expandedGroups)) {
        setExpandedGroups((prev) => new Set(prev).add(gi));
      }
      onGoToTick(nextEntry.tickId);
    }
  }, [sortedHistory, viewedTickId, onGoToTick, visibleCount, loadMore, groups, expandedGroups]);

  if (history.length === 0) return null;

  const hasMore = visibleCount < totalEntryCount;

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
        {visibleItems.map((item) => {
          if (item.type === 'entry') {
            return (
              <HistoryEntryRow
                key={item.entry.tickId}
                entry={item.entry}
                isActive={item.entry.tickId === viewedTickId}
                changed={item.changed}
                onGoToTick={onGoToTick}
              />
            );
          }
          return (
            <GroupHeaderRow
              key={`g-${item.groupIndex}`}
              group={item.group}
              groupIndex={item.groupIndex}
              viewedTickId={viewedTickId}
              onToggle={toggleGroup}
            />
          );
        })}
        {hasMore && (
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
  changed: boolean;
  onGoToTick: (tickId: number) => void;
}

function HistoryEntryRowInner({ entry, isActive, changed, onGoToTick }: HistoryEntryRowProps) {
  const handleClick = useCallback(() => {
    onGoToTick(entry.tickId);
  }, [entry.tickId, onGoToTick]);

  const className = [
    'bt-history__entry',
    isActive && 'bt-history__entry--active',
    changed && 'bt-history__entry--changed',
  ].filter(Boolean).join(' ');

  const borderLeftColor = changed ? undefined : getResultColor(entry.result);

  return (
    <button
      className={className}
      onClick={handleClick}
      type="button"
      data-tick-id={entry.tickId}
      style={borderLeftColor ? { borderLeftColor } : undefined}
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

interface GroupHeaderRowProps {
  group: HistoryGroup;
  groupIndex: number;
  viewedTickId: number | null;
  onToggle: (groupIndex: number) => void;
}

function GroupHeaderRowInner({ group, groupIndex, viewedTickId, onToggle }: GroupHeaderRowProps) {
  const handleClick = useCallback(() => {
    onToggle(groupIndex);
  }, [groupIndex, onToggle]);

  const firstTick = group.entries[0].tickId;
  const lastTick = group.entries[group.entries.length - 1].tickId;
  const containsActive = viewedTickId !== null && group.entries.some((e) => e.tickId === viewedTickId);

  return (
    <button
      type="button"
      className={`bt-history__group-header${containsActive ? ' bt-history__group-header--contains-active' : ''}`}
      onClick={handleClick}
      style={{ borderLeftColor: getResultColor(group.result) }}
    >
      <span className="bt-history__tick-id">#{firstTick}\u2013#{lastTick}</span>
      <span
        className="bt-history__result-dot"
        style={{ backgroundColor: getResultColor(group.result) }}
      />
      <span className="bt-history__result-label">{group.result}</span>
      <span className="bt-history__group-count">\u00d7{group.entries.length}</span>
    </button>
  );
}

const HistoryEntryRow = memo(HistoryEntryRowInner);
const GroupHeaderRow = memo(GroupHeaderRowInner);

export const NodeHistory = memo(NodeHistoryInner);
