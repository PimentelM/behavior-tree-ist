import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { NodeFlags, NodeResult } from '@behavior-tree-ist/core';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { BehaviourTreeDebugger } from '../BehaviourTreeDebugger';
import type { BTNodeData, BTEdgeData } from '../types';
import type { Node, Edge } from '@xyflow/react';

vi.mock('../components/TreeCanvas', () => ({
  TreeCanvas: ({
    nodes,
    edges,
  }: {
    nodes: Node<BTNodeData>[];
    edges: Edge<BTEdgeData>[];
  }) => (
    <div data-testid="tree-canvas">
      <div data-testid="tree-canvas-node-flags">
        {nodes
          .map((node) => `${node.data.nodeId}:${node.data.isOnActivityPath ? 'p' : ''}${node.data.isActivityTail ? 't' : ''}`)
          .join('|')}
      </div>
      <div data-testid="tree-canvas-edge-flags">
        {edges
          .filter((edge) => edge.data?.isOnActivityPathEdge)
          .map((edge) => edge.id)
          .join('|')}
      </div>
    </div>
  ),
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
        nodeId: 1,
        result: NodeResult.Succeeded,
        startedAt: 0,
        finishedAt: durationMs,
      },
    ],
  };
}

function makeDiagnosticsTree(): SerializableNode {
  return {
    id: 1,
    nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
    defaultName: 'Sequence',
    name: 'Root',
    activity: 'Guarding',
    children: [
      {
        id: 2,
        nodeFlags: NodeFlags.Composite | NodeFlags.Sequence,
        defaultName: 'Sequence',
        name: 'Diagnostics',
        activity: 'Diagnostics',
        children: [
          {
            id: 3,
            nodeFlags: NodeFlags.Composite | NodeFlags.Parallel,
            defaultName: 'Parallel',
            name: 'DiagnosticsParallel',
            activity: 'Diagnostics Loop',
            children: [
              {
                id: 4,
                nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                defaultName: 'AlwaysRunning',
                name: 'AlwaysRunning',
              },
              {
                id: 5,
                nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
                defaultName: 'ResultsTransformersShowcase',
                name: 'ResultsTransformersShowcase',
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeDiagnosticsTick(): TickRecord {
  return {
    tickId: 1,
    timestamp: 1000,
    refEvents: [],
    events: [
      { nodeId: 4, result: NodeResult.Running },
      { nodeId: 5, result: NodeResult.Succeeded },
      { nodeId: 3, result: NodeResult.Running },
      { nodeId: 2, result: NodeResult.Running },
      { nodeId: 1, result: NodeResult.Running },
    ],
  };
}

function makeModeSwitchTree(): SerializableNode {
  return {
    id: 1,
    nodeFlags: NodeFlags.Composite | NodeFlags.Parallel,
    defaultName: 'Parallel',
    name: 'RootNode',
    activity: 'Guarding',
    children: [
      {
        id: 2,
        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
        defaultName: 'AttackAction',
        name: 'AttackIntent',
        activity: 'Attacking',
      },
      {
        id: 3,
        nodeFlags: NodeFlags.Leaf | NodeFlags.Action,
        defaultName: 'PatrolAction',
        name: 'PatrolIntent',
        activity: 'Patrolling',
      },
    ],
  };
}

function makeModeSwitchTick(): TickRecord {
  return {
    tickId: 1,
    timestamp: 1000,
    refEvents: [],
    events: [
      { nodeId: 2, result: NodeResult.Succeeded },
      { nodeId: 3, result: NodeResult.Running },
      { nodeId: 1, result: NodeResult.Running },
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

  it('toggles the floating current activity window from toolbar', () => {
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeTree()}
        ticks={[makeTick(1, 2)]}
        isolateStyles={false}
      />,
    );

    const local = within(container);
    expect(local.getAllByText('Current Activity').length).toBeGreaterThan(0);

    fireEvent.click(local.getByRole('button', { name: 'Hide current activity window' }));
    expect(local.queryByText('No activity for this tick')).toBeNull();
    expect(local.getByRole('button', { name: 'Show current activity window' })).toBeTruthy();
  });

  it('allows dragging the floating current activity window', async () => {
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeTree()}
        ticks={[makeTick(1, 2)]}
        isolateStyles={false}
      />,
    );

    const surface = container.querySelector('.bt-canvas-surface') as HTMLElement;
    const activityWindow = container.querySelector('.bt-canvas-surface__activity') as HTMLElement;
    const dragHandle = container.querySelector('.bt-canvas-surface__activity-header') as HTMLElement;

    Object.defineProperty(surface, 'clientWidth', { value: 900, configurable: true });
    Object.defineProperty(surface, 'clientHeight', { value: 500, configurable: true });
    Object.defineProperty(activityWindow, 'offsetWidth', { value: 320, configurable: true });
    Object.defineProperty(activityWindow, 'offsetHeight', { value: 160, configurable: true });

    const initialTransform = activityWindow.style.transform;

    fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 210, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 1 });

    await waitFor(() => {
      expect(activityWindow.style.transform).not.toBe(initialTransform);
    });
  });

  it('collapses and expands the floating current activity window', () => {
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeTree()}
        ticks={[makeTick(1, 2)]}
        isolateStyles={false}
      />,
    );

    const local = within(container);
    expect(local.getByText('No activity for this tick')).toBeTruthy();

    fireEvent.click(local.getByRole('button', { name: 'Collapse current activity window' }));
    expect(local.queryByText('No activity for this tick')).toBeNull();
    const collapsedTitle = container.querySelector('.bt-canvas-surface__activity-title');
    expect(collapsedTitle?.textContent ?? '').toContain('Current Activity:');
    expect(collapsedTitle?.textContent ?? '').toContain('No activity');

    fireEvent.click(local.getByRole('button', { name: 'Expand current activity window' }));
    expect(local.getByText('No activity for this tick')).toBeTruthy();
  });

  it('dedupes duplicate terminal entries and anchors selection to tail activity node', () => {
    const onNodeSelect = vi.fn();
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeDiagnosticsTree()}
        ticks={[makeDiagnosticsTick()]}
        activityDisplayMode="all"
        isolateStyles={false}
        onNodeSelect={onNodeSelect}
      />,
    );

    const local = within(container);
    const label = 'Guarding > Diagnostics > Diagnostics Loop';
    const entries = local.getAllByRole('button', { name: new RegExp(label, 'i') });
    expect(entries).toHaveLength(1);

    onNodeSelect.mockClear();
    fireEvent.click(entries[0]);
    expect(onNodeSelect).toHaveBeenCalledWith(3);

    const nodeFlagsEntries = screen.getAllByTestId('tree-canvas-node-flags');
    const nodeFlags = nodeFlagsEntries[nodeFlagsEntries.length - 1]?.textContent ?? '';
    expect(nodeFlags).toContain('1:p');
    expect(nodeFlags).toContain('2:p');
    expect(nodeFlags).toContain('3:pt');

    const edgeFlagsEntries = screen.getAllByTestId('tree-canvas-edge-flags');
    const edgeFlags = edgeFlagsEntries[edgeFlagsEntries.length - 1]?.textContent ?? '';
    expect(edgeFlags).toContain('e-1-2');
    expect(edgeFlags).toContain('e-2-3');
  });

  it('supports switching activity modes and text source from activity window controls', () => {
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeModeSwitchTree()}
        ticks={[makeModeSwitchTick()]}
        isolateStyles={false}
      />,
    );

    const local = within(container);
    expect(local.getByTitle('Guarding > Patrolling')).toBeTruthy();
    expect(local.queryByTitle('Guarding > Attacking')).toBeNull();

    fireEvent.click(local.getByRole('button', { name: 'Show activity options menu' }));
    fireEvent.click(local.getByRole('button', { name: 'Show running and success activities' }));
    expect(local.getByTitle('Guarding > Attacking')).toBeTruthy();

    fireEvent.click(local.getByRole('button', { name: 'Show node names' }));
    expect(local.getByTitle('RootNode > AttackIntent')).toBeTruthy();
    expect(local.getByTitle('RootNode > PatrolIntent')).toBeTruthy();
  });

  it('allows collapsing and expanding the activity options menu', () => {
    const { container } = render(
      <BehaviourTreeDebugger
        tree={makeModeSwitchTree()}
        ticks={[makeModeSwitchTick()]}
        isolateStyles={false}
      />,
    );

    const local = within(container);
    expect(local.queryByRole('button', { name: 'Show only running activities' })).toBeNull();
    expect(local.queryByRole('button', { name: 'Show activity labels' })).toBeNull();

    fireEvent.click(local.getByRole('button', { name: 'Show activity options menu' }));
    expect(local.getByRole('button', { name: 'Show only running activities' })).toBeTruthy();
    expect(local.getByRole('button', { name: 'Show activity labels' })).toBeTruthy();

    fireEvent.click(local.getByRole('button', { name: 'Hide activity options menu' }));
    expect(local.queryByRole('button', { name: 'Show only running activities' })).toBeNull();
    expect(local.queryByRole('button', { name: 'Show activity labels' })).toBeNull();
    expect(local.getByTitle('Guarding > Patrolling')).toBeTruthy();

    fireEvent.click(local.getByRole('button', { name: 'Show activity options menu' }));
    expect(local.getByRole('button', { name: 'Show only running activities' })).toBeTruthy();
    expect(local.getByRole('button', { name: 'Show activity labels' })).toBeTruthy();
  });
});
