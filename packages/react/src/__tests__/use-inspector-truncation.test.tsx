import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { NodeFlags, NodeResult } from '@behavior-tree-ist/core';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { useInspector } from '../hooks/useInspector';

function makeTick(tickId: number): TickRecord {
  return {
    tickId,
    timestamp: tickId,
    refEvents: [],
    events: [
      {
        tickId,
        nodeId: 1,
        timestamp: tickId,
        result: NodeResult.Succeeded,
      },
    ],
  };
}

type HarnessProps = {
  tree: SerializableNode;
  ticks: TickRecord[];
  onTickIds: (tickIds: number[]) => void;
};

function InspectorHarness({ tree, ticks, onTickIds }: HarnessProps) {
  const { inspector, tickGeneration } = useInspector(tree, ticks);

  useEffect(() => {
    onTickIds(inspector.getStoredTickIds());
  }, [inspector, tickGeneration, onTickIds]);

  return null;
}

describe('useInspector tick truncation handling', () => {
  it('re-indexes inspector when ticks array is truncated', async () => {
    const tree: SerializableNode = {
      id: 1,
      nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
      defaultName: 'Action',
      name: 'Action',
    };

    const tick1 = makeTick(1);
    const tick2 = makeTick(2);

    let latestTickIds: number[] = [];

    const { rerender } = render(
      <InspectorHarness
        tree={tree}
        ticks={[tick1, tick2]}
        onTickIds={(tickIds) => {
          latestTickIds = tickIds;
        }}
      />,
    );

    await waitFor(() => {
      expect(latestTickIds).toEqual([1, 2]);
    });

    rerender(
      <InspectorHarness
        tree={tree}
        ticks={[tick2]}
        onTickIds={(tickIds) => {
          latestTickIds = tickIds;
        }}
      />,
    );

    await waitFor(() => {
      expect(latestTickIds).toEqual([2]);
    });
  });
});
