import { useRef, useMemo, useState, useEffect } from 'react';
import type { SerializableNode, TickRecord } from '@bt-studio/core';
import { TreeInspector } from '@bt-studio/core/inspector';
import type { TreeInspectorOptions } from '@bt-studio/core/inspector';

export interface UseInspectorResult {
  inspector: TreeInspector;
  tickGeneration: number;
}

export function useInspector(
  tree: SerializableNode,
  ticks: TickRecord[],
  options?: TreeInspectorOptions,
): UseInspectorResult {
  const inspectorRef = useRef<TreeInspector | null>(null);
  // Track all ingested tickIds by Set (supports bidirectional window insertion)
  const ingestedTickIdsRef = useRef<Set<number>>(new Set());
  const [tickGeneration, setTickGeneration] = useState(0);
  const prevTreeRef = useRef<SerializableNode | null>(null);

  const inspector = useMemo(() => {
    const inst = new TreeInspector(options);
    inspectorRef.current = inst;
    ingestedTickIdsRef.current = new Set();
    prevTreeRef.current = tree;
    inst.indexTree(tree);
    return inst;
    // Re-create inspector when tree identity or options change
  }, [tree, options?.maxTicks]);

  // Re-index if tree reference changed but inspector was reused
  useEffect(() => {
    if (prevTreeRef.current !== tree) {
      inspector.reset();
      inspector.indexTree(tree);
      ingestedTickIdsRef.current = new Set();
      prevTreeRef.current = tree;
      setTickGeneration((g) => g + 1);
    }
  }, [tree, inspector]);

  // Diff-ingest new ticks using Set tracking (handles sliding-window + windowed inserts)
  useEffect(() => {
    const ingested = ingestedTickIdsRef.current;
    const newTicks = ticks.filter((t) => !ingested.has(t.tickId));
    if (newTicks.length === 0) return;

    const newestStored = inspector.getStats().newestTickId;
    const cutoff = newestStored ?? -Infinity;

    // Forward ticks: append as usual
    const forwardTicks = newTicks.filter((t) => t.tickId > cutoff);
    if (forwardTicks.length > 0) {
      inspector.ingestTicks(forwardTicks);
    }

    // Backward ticks: use insertTicks if available (added by data-layer builder)
    const backwardTicks = newTicks.filter((t) => t.tickId <= cutoff);
    if (backwardTicks.length > 0) {
      const insertTicks = (inspector as unknown as { insertTicks?: (r: TickRecord[]) => void }).insertTicks;
      insertTicks?.call(inspector, backwardTicks);
    }

    for (const t of newTicks) ingested.add(t.tickId);
    setTickGeneration((g) => g + 1);
  }, [ticks, inspector]);

  return { inspector, tickGeneration };
}
