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
  // Track all ingested tickIds by Set for dedup and seek detection
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

  // Diff-ingest new ticks using Set tracking (forward-only; TT windows are static)
  useEffect(() => {
    const ingested = ingestedTickIdsRef.current;
    const newTicks = ticks.filter((t) => !ingested.has(t.tickId));
    if (newTicks.length === 0) return;

    // Detect window replacement (seek): previously ingested ticks but none appear in the
    // new ticks array → the window was fully replaced, clear the inspector first.
    if (ingested.size > 0 && ticks.every((t) => !ingested.has(t.tickId))) {
      inspector.clearTicks();
      ingestedTickIdsRef.current = new Set();
    }

    inspector.ingestTicks(newTicks);
    for (const t of newTicks) ingestedTickIdsRef.current.add(t.tickId);
    setTickGeneration((g) => g + 1);
  }, [ticks, inspector]);

  return { inspector, tickGeneration };
}
