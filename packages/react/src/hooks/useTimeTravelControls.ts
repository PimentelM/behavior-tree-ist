import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { TreeInspector } from '@bt-studio/core/inspector';
import type { TimeTravelControls, StudioTickBounds } from '../types';

function isUnixTimestampLike(now: number): boolean {
  const absNow = Math.abs(now);
  const asMilliseconds = absNow >= 1e12 ? absNow : absNow >= 1e9 ? absNow * 1000 : undefined;
  if (asMilliseconds === undefined) return false;

  const current = Date.now();
  const fiftyYears = 50 * 365 * 24 * 60 * 60 * 1000;
  return Math.abs(asMilliseconds - current) <= fiftyYears;
}

export interface UseTimeTravelControlsOptions {
  onNeedTick?: (tickId: number) => void;
  serverBounds?: StudioTickBounds | null;
  isLoading?: boolean;
}

export function useTimeTravelControls(
  inspector: TreeInspector,
  _tickGeneration: number,
  options?: UseTimeTravelControlsOptions,
): TimeTravelControls {
  const [mode, setMode] = useState<'live' | 'paused'>('live');
  const [frozenTickId, setFrozenTickId] = useState<number | null>(null);

  const stats = inspector.getStats();
  const storedIds = inspector.getStoredTickIds();
  const totalTicks = stats.totalTickCount;
  const oldestTickId = stats.oldestTickId;
  const newestTickId = stats.newestTickId;
  const nowIsTimestampRef = useRef<boolean | null>(null);

  const onNeedTick = options?.onNeedTick;
  const serverBounds = options?.serverBounds ?? null;
  const isLoading = options?.isLoading ?? false;

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
    // If tick not in loaded window, request a fetch from the parent
    if (!storedIds.includes(tickId)) {
      onNeedTick?.(tickId);
    }
  }, [storedIds, onNeedTick]);

  const stepForward = useCallback(() => {
    if (storedIds.length === 0) return;
    const currentId = viewedTickId ?? storedIds[0];
    const idx = storedIds.indexOf(currentId);
    if (idx < storedIds.length - 1) {
      setMode('paused');
      setFrozenTickId(storedIds[idx + 1]);
    } else if (serverBounds && currentId < serverBounds.maxTickId) {
      // At edge of loaded window but more on server — request fetch
      onNeedTick?.(currentId + 1);
    }
  }, [storedIds, viewedTickId, serverBounds, onNeedTick]);

  const stepBack = useCallback(() => {
    if (storedIds.length === 0) return;
    const currentId = viewedTickId ?? storedIds[storedIds.length - 1];
    const idx = storedIds.indexOf(currentId);
    if (idx > 0) {
      setMode('paused');
      setFrozenTickId(storedIds[idx - 1]);
    } else if (serverBounds && currentId > serverBounds.minTickId) {
      // At edge of loaded window but more history on server — request fetch
      onNeedTick?.(currentId - 1);
    }
  }, [storedIds, viewedTickId, serverBounds, onNeedTick]);

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
    // Only clamp if tick is not fetchable via server
    if (serverBounds && frozenTickId >= serverBounds.minTickId && frozenTickId <= serverBounds.maxTickId) return;
    setFrozenTickId(storedIds[0]);
  }, [mode, frozenTickId, storedIds, serverBounds]);

  return {
    mode,
    viewedTickId,
    viewedNow,
    nowIsTimestamp,
    totalTicks,
    oldestTickId,
    newestTickId,
    serverBounds,
    isLoading,
    goToTick,
    stepForward,
    stepBack,
    jumpToLive,
    pause,
  };
}
