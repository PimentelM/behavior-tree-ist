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
  const lastIngestedTickIdRef = useRef(0);
  const [tickGeneration, setTickGeneration] = useState(0);
  const prevTreeRef = useRef<SerializableNode | null>(null);

  const inspector = useMemo(() => {
    const inst = new TreeInspector(options);
    inspectorRef.current = inst;
    lastIngestedTickIdRef.current = 0;
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
      lastIngestedTickIdRef.current = 0;
      prevTreeRef.current = tree;
      setTickGeneration((g) => g + 1);
    }
  }, [tree, inspector]);

  // Diff-ingest new ticks (track by tickId to handle sliding-window arrays)
  useEffect(() => {
    const lastId = lastIngestedTickIdRef.current;
    let i = 0;
    while (i < ticks.length && ticks[i].tickId <= lastId) i++;
    if (i < ticks.length) {
      for (; i < ticks.length; i++) {
        inspector.ingestTick(ticks[i]);
      }
      lastIngestedTickIdRef.current = ticks[ticks.length - 1].tickId;
      setTickGeneration((g) => g + 1);
    }
  }, [ticks, inspector]);

  return { inspector, tickGeneration };
}
