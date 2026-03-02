import { useRef, useMemo, useState, useEffect } from 'react';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { TreeInspectorOptions } from '@behavior-tree-ist/core/inspector';

export interface UseInspectorResult {
  inspector: TreeInspector;
  tickGeneration: number;
}

export function useInspector(
  tree: SerializableNode | undefined,
  ticks: TickRecord[] | undefined,
  options?: TreeInspectorOptions,
): UseInspectorResult {
  const inspectorRef = useRef<TreeInspector | null>(null);
  const ingestedCountRef = useRef(0);
  const [tickGeneration, setTickGeneration] = useState(0);
  const prevTreeRef = useRef<SerializableNode | undefined>(undefined);

  const inspector = useMemo(() => {
    const inst = new TreeInspector(options);
    inspectorRef.current = inst;
    ingestedCountRef.current = 0;
    prevTreeRef.current = tree;
    if (tree) {
      inst.indexTree(tree);
    }
    return inst;
    // Re-create inspector when tree identity or options change
  }, [tree, options?.maxTicks]);

  // Re-index if tree reference changed but inspector was reused
  useEffect(() => {
    if (prevTreeRef.current !== tree) {
      inspector.reset();
      if (tree) {
        inspector.indexTree(tree);
      }
      ingestedCountRef.current = 0;
      prevTreeRef.current = tree;
      setTickGeneration((g) => g + 1);
    }
  }, [tree, inspector]);

  // Diff-ingest new ticks
  useEffect(() => {
    const currentTicks = ticks ?? [];
    const alreadyIngested = ingestedCountRef.current;
    if (currentTicks.length > alreadyIngested) {
      for (let i = alreadyIngested; i < currentTicks.length; i++) {
        inspector.ingestTick(currentTicks[i]);
      }
      ingestedCountRef.current = currentTicks.length;
      setTickGeneration((g) => g + 1);
    }
  }, [ticks?.length, inspector]);

  return { inspector, tickGeneration };
}
