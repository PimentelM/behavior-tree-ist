import { useRef, useMemo, useState, useEffect } from 'react';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { TreeInspectorOptions } from '@behavior-tree-ist/core/inspector';

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
  const ingestedCountRef = useRef(0);
  const [tickGeneration, setTickGeneration] = useState(0);
  const prevTreeRef = useRef<SerializableNode | null>(null);

  const inspector = useMemo(() => {
    const inst = new TreeInspector(options);
    inspectorRef.current = inst;
    ingestedCountRef.current = 0;
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
      ingestedCountRef.current = 0;
      prevTreeRef.current = tree;
      setTickGeneration((g) => g + 1);
    }
  }, [tree, inspector]);

  // Diff-ingest new ticks
  useEffect(() => {
    const alreadyIngested = ingestedCountRef.current;
    if (ticks.length < alreadyIngested) {
      inspector.reset();
      inspector.indexTree(tree);
      for (let i = 0; i < ticks.length; i++) {
        inspector.ingestTick(ticks[i]);
      }
      ingestedCountRef.current = ticks.length;
      prevTreeRef.current = tree;
      setTickGeneration((g) => g + 1);
      return;
    }

    if (ticks.length > alreadyIngested) {
      for (let i = alreadyIngested; i < ticks.length; i++) {
        inspector.ingestTick(ticks[i]);
      }
      ingestedCountRef.current = ticks.length;
      setTickGeneration((g) => g + 1);
    }
  }, [ticks, ticks.length, inspector]);

  return { inspector, tickGeneration };
}
