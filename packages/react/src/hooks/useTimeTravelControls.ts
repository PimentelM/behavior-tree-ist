import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { TimeTravelControls } from '../types';

function isUnixTimestampLike(now: number): boolean {
  const absNow = Math.abs(now);
  const asMilliseconds = absNow >= 1e12 ? absNow : absNow >= 1e9 ? absNow * 1000 : undefined;
  if (asMilliseconds === undefined) return false;

  const current = Date.now();
  const fiftyYears = 50 * 365 * 24 * 60 * 60 * 1000;
  return Math.abs(asMilliseconds - current) <= fiftyYears;
}

export function useTimeTravelControls(
  inspector: TreeInspector,
  _tickGeneration: number,
): TimeTravelControls {
  const [mode, setMode] = useState<'live' | 'paused'>('live');
  const [frozenTickId, setFrozenTickId] = useState<number | null>(null);

  const stats = inspector.getStats();
  const storedIds = inspector.getStoredTickIds();
  const totalTicks = stats.totalTickCount;
  const oldestTickId = stats.oldestTickId;
  const newestTickId = stats.newestTickId;
  const nowIsTimestampRef = useRef<boolean | null>(null);

  // In live mode, always show newest tick
  const viewedTickId = mode === 'live' ? (newestTickId ?? null) : frozenTickId;
  const viewedNow = useMemo(() => {
    if (viewedTickId === null) return null;
    const records = inspector.getTickRange(viewedTickId, viewedTickId);
    const record = records[0];
    return record?.timestamp ?? null;
  }, [inspector, viewedTickId]);

  if (nowIsTimestampRef.current === null && viewedNow !== null) {
    nowIsTimestampRef.current = isUnixTimestampLike(viewedNow);
  }
  const nowIsTimestamp = nowIsTimestampRef.current;

  // When new ticks arrive in live mode, we automatically follow
  // (viewedTickId is derived from newestTickId)

  const goToTick = useCallback((tickId: number) => {
    setMode('paused');
    setFrozenTickId(tickId);
  }, []);

  const stepForward = useCallback(() => {
    if (storedIds.length === 0) return;
    const currentId = viewedTickId ?? storedIds[0];
    const idx = storedIds.indexOf(currentId);
    if (idx < storedIds.length - 1) {
      setMode('paused');
      setFrozenTickId(storedIds[idx + 1]);
    }
  }, [storedIds, viewedTickId]);

  const stepBack = useCallback(() => {
    if (storedIds.length === 0) return;
    const currentId = viewedTickId ?? storedIds[storedIds.length - 1];
    const idx = storedIds.indexOf(currentId);
    if (idx > 0) {
      setMode('paused');
      setFrozenTickId(storedIds[idx - 1]);
    }
  }, [storedIds, viewedTickId]);

  const jumpToLive = useCallback(() => {
    setMode('live');
    setFrozenTickId(null);
  }, []);

  const pause = useCallback(() => {
    setMode('paused');
    setFrozenTickId(newestTickId ?? null);
  }, [newestTickId]);

  // Reset to live when inspector is reset (tree changes)
  useEffect(() => {
    if (totalTicks === 0) {
      setMode('live');
      setFrozenTickId(null);
      nowIsTimestampRef.current = null;
    }
  }, [totalTicks]);

  // If paused on an evicted tick, clamp to the oldest available tick.
  useEffect(() => {
    if (mode !== 'paused' || frozenTickId === null || storedIds.length === 0) return;
    if (storedIds.includes(frozenTickId)) return;
    setFrozenTickId(storedIds[0]);
  }, [mode, frozenTickId, storedIds]);

  return {
    mode,
    viewedTickId,
    viewedNow,
    nowIsTimestamp,
    totalTicks,
    oldestTickId,
    newestTickId,
    goToTick,
    stepForward,
    stepBack,
    jumpToLive,
    pause,
  };
}
