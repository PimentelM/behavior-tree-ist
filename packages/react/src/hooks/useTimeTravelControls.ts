import { useState, useCallback, useEffect } from 'react';
import type { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { TimeTravelControls } from '../types';

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

  // In live mode, always show newest tick
  const viewedTickId = mode === 'live' ? (newestTickId ?? null) : frozenTickId;

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
