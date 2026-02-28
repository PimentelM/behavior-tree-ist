import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeFlags, NodeResult } from '@behavior-tree-ist/core';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { BehaviourTreeDebugger } from '../BehaviourTreeDebugger';

vi.mock('../components/TreeCanvas', () => ({
  TreeCanvas: () => <div data-testid="tree-canvas" />,
}));

function makeTree(): SerializableNode {
  return {
    id: 1,
    nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
    defaultName: 'RootAction',
    name: '',
  };
}

function makeTick(tickId: number, durationMs: number): TickRecord {
  return {
    tickId,
    timestamp: tickId * 1000,
    refEvents: [],
    events: [
      {
        tickId,
        nodeId: 1,
        timestamp: tickId * 1000,
        result: NodeResult.Succeeded,
        startedAt: 0,
        finishedAt: durationMs,
      },
    ],
  };
}

describe('BehaviourTreeDebugger time-travel percentile mode', () => {
  it('switches performance percentiles from sampled to exact when pausing', async () => {
    const ticks: TickRecord[] = [
      makeTick(1, 100),
      makeTick(2, 1),
      makeTick(3, 2),
    ];

    render(
      <BehaviourTreeDebugger
        tree={makeTree()}
        ticks={ticks}
        inspectorOptions={{ maxTicks: 2 }}
        isolateStyles={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch to performance view' }));
    expect(screen.getByText('Approx')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Pause and enter time travel' }));

    await waitFor(() => {
      expect(screen.queryByText('Approx')).toBeNull();
    });
  });
});
