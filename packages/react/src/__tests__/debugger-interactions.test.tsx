import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeResult, NodeFlags } from '@behavior-tree-ist/core';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import type { NodeDetailsData } from '../types';
import type { NodeProfilingData } from '@behavior-tree-ist/core/inspector';
import { NodeDetailPanel } from '../components/panels/NodeDetailPanel';
import { RefTracesPanel } from '../components/panels/RefTracesPanel';

function makeDetails(overrides: Partial<NodeDetailsData> = {}): NodeDetailsData {
  return {
    nodeId: 1,
    name: 'TestAction',
    defaultName: 'Action',
    flags: NodeFlags.Leaf | NodeFlags.Action,
    path: 'root/TestAction',
    tags: [],
    resultSummary: new Map([[NodeResult.Succeeded, 5]]),
    history: [
      { tickId: 1, result: NodeResult.Succeeded, timestamp: 100 },
      { tickId: 2, result: NodeResult.Succeeded, timestamp: 200 },
    ],
    currentResult: NodeResult.Succeeded,
    currentDisplayState: undefined,
    currentDisplayStateIsStale: false,
    profilingData: undefined,
    ...overrides,
  };
}

function makeRefEvent(overrides: Partial<RefChangeEvent> = {}): RefChangeEvent {
  return {
    tickId: 1,
    timestamp: 100,
    refName: 'myRef',
    nodeId: 10,
    newValue: 42,
    isAsync: false,
    ...overrides,
  };
}

function makeProfilingData(overrides: Partial<NodeProfilingData> = {}): NodeProfilingData {
  return {
    nodeId: 1,
    totalCpuTime: 10,
    tickCount: 5,
    minCpuTime: 1,
    maxCpuTime: 4,
    lastCpuTime: 2,
    totalRunningTime: 0,
    runningTimeCount: 0,
    minRunningTime: Infinity,
    maxRunningTime: 0,
    lastRunningTime: 0,
    ...overrides,
  };
}

describe('NodeDetailPanel', () => {
  const defaultProps = {
    refEvents: [] as RefChangeEvent[],
    viewedTickId: 2,
    openDetailsSignal: 0,
    showRefTraces: false,
    onGoToTick: vi.fn(),
    onFocusActorNode: vi.fn(),
  };

  it('shows selected node name and updates when details change', () => {
    const details = makeDetails({ name: 'AlphaNode', defaultName: 'Action' });
    const { rerender } = render(
      <NodeDetailPanel {...defaultProps} details={details} />,
    );

    expect(screen.getByText('AlphaNode')).toBeTruthy();

    const updated = makeDetails({
      nodeId: 2,
      name: 'BetaNode',
      defaultName: 'Action',
      path: 'root/BetaNode',
    });
    rerender(<NodeDetailPanel {...defaultProps} details={updated} />);

    expect(screen.getByText('BetaNode')).toBeTruthy();
    expect(screen.queryByText('AlphaNode')).toBeNull();
  });

  it('shows empty state when no node is selected', () => {
    render(<NodeDetailPanel {...defaultProps} details={null} />);

    expect(screen.getByText('Select a node to inspect')).toBeTruthy();
  });

  it('switches back to details tab when openDetailsSignal changes', () => {
    const details = makeDetails();
    const events: RefChangeEvent[] = [makeRefEvent()];

    const { rerender } = render(
      <NodeDetailPanel
        {...defaultProps}
        details={details}
        refEvents={events}
        showRefTraces={true}
        openDetailsSignal={0}
      />,
    );

    // Click "Ref details" tab
    fireEvent.click(screen.getByText('Ref details'));

    // Ref traces content should be visible (the section title)
    expect(screen.getByText('Last known ref states')).toBeTruthy();

    // Change openDetailsSignal to force back to details tab
    rerender(
      <NodeDetailPanel
        {...defaultProps}
        details={details}
        refEvents={events}
        showRefTraces={true}
        openDetailsSignal={1}
      />,
    );

    // Should be back on the details tab — node name visible
    expect(screen.getByText('TestAction')).toBeTruthy();
    // Ref traces section title should not be visible
    expect(screen.queryByText('Last known ref states')).toBeNull();
  });

  it('shows profiling data when available', () => {
    const profiling = makeProfilingData({
      totalCpuTime: 10,
      tickCount: 5,
      minCpuTime: 1,
      maxCpuTime: 4,
    });
    const details = makeDetails({ profilingData: profiling });

    const { rerender } = render(
      <NodeDetailPanel {...defaultProps} details={details} />,
    );

    // Profiling section should be visible
    expect(screen.getByText('Profiling')).toBeTruthy();
    expect(screen.getByText('CPU Time')).toBeTruthy();
    expect(screen.getByText('Ticks')).toBeTruthy();

    // Re-render without profiling data — section should disappear
    const detailsNoProfiling = makeDetails({ profilingData: undefined });
    rerender(
      <NodeDetailPanel {...defaultProps} details={detailsNoProfiling} />,
    );

    expect(screen.queryByText('Profiling')).toBeNull();
  });

  it('shows running time section only when running time data exists', () => {
    const profilingWithRunning = makeProfilingData({
      totalRunningTime: 100,
      runningTimeCount: 3,
      minRunningTime: 20,
      maxRunningTime: 50,
    });
    const details = makeDetails({ profilingData: profilingWithRunning });

    render(<NodeDetailPanel {...defaultProps} details={details} />);

    expect(screen.getByText('Running Time')).toBeTruthy();
  });
});

describe('RefTracesPanel', () => {
  it('calls onGoToTick and onFocusActorNode when clicking a ref event entry', () => {
    const onGoToTick = vi.fn();
    const onFocusActorNode = vi.fn();

    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 5, nodeId: 42, refName: 'health' }),
    ];

    render(
      <RefTracesPanel
        events={events}
        viewedTickId={5}
        onGoToTick={onGoToTick}
        onFocusActorNode={onFocusActorNode}
      />,
    );

    // The ref event timeline section should show the entry
    // Click the entry in the event timeline (it's the button with the ref name)
    const entryButtons = screen.getAllByRole('button');
    // Find the entry button for our ref event (has "health" text)
    const refButton = entryButtons.find(
      (btn) => btn.textContent?.includes('health') && btn.textContent?.includes('tick #5'),
    );
    expect(refButton).toBeTruthy();

    fireEvent.click(refButton!);

    expect(onGoToTick).toHaveBeenCalledWith(5);
    expect(onFocusActorNode).toHaveBeenCalledWith(42);
  });
});
