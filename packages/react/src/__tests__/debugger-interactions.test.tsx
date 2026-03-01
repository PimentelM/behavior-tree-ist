import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { NodeResult, NodeFlags } from '@behavior-tree-ist/core';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import type { NodeDetailsData } from '../types';
import type { FlameGraphFrame, NodeProfilingData, TreeStats } from '@behavior-tree-ist/core/inspector';
import { NodeDetailPanel } from '../components/panels/NodeDetailPanel';
import { RefTracesPanel } from '../components/panels/RefTracesPanel';
import { PerformanceView } from '../components/panels/PerformanceView';

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
    metadata: undefined,
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
    totalSelfCpuTime: 6,
    minSelfCpuTime: 0.5,
    maxSelfCpuTime: 2,
    lastSelfCpuTime: 1,
    selfCpuP50: 1,
    selfCpuP95: 2,
    selfCpuP99: 2,
    cpuP50: 2,
    cpuP95: 4,
    cpuP99: 4,
    totalRunningTime: 0,
    runningTimeCount: 0,
    minRunningTime: Infinity,
    maxRunningTime: 0,
    lastRunningTime: 0,
    ...overrides,
  };
}

function makeStats(overrides: Partial<TreeStats> = {}): TreeStats {
  return {
    nodeCount: 3,
    storedTickCount: 1,
    totalTickCount: 1,
    totalProfilingCpuTime: 175,
    totalRootCpuTime: 100,
    totalProfilingRunningTime: 0,
    oldestTickId: 1,
    newestTickId: 1,
    profilingWindowStart: 0,
    profilingWindowEnd: 100,
    profilingWindowSpan: 100,
    ...overrides,
  };
}

function makeFrame(overrides: Partial<FlameGraphFrame> = {}): FlameGraphFrame {
  return {
    nodeId: 1,
    name: 'Root',
    depth: 0,
    inclusiveTime: 10,
    selfTime: 5,
    startedAt: 0,
    finishedAt: 10,
    children: [],
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
    expect(screen.getByText('Self CPU Time')).toBeTruthy();
    expect(screen.getAllByText('p95').length).toBeGreaterThan(0);
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

describe('PerformanceView', () => {
  it('uses root total cpu as hot-node percent denominators and separates tick/window summary', () => {
    const hotNodes: NodeProfilingData[] = [
      makeProfilingData({ nodeId: 1, totalCpuTime: 100, totalSelfCpuTime: 60, tickCount: 1 }),
      makeProfilingData({ nodeId: 2, totalCpuTime: 25, totalSelfCpuTime: 15, tickCount: 1 }),
    ];

    render(
      <PerformanceView
        frames={[makeFrame({ nodeId: 1, inclusiveTime: 100, finishedAt: 100 })]}
        hotNodes={hotNodes}
        stats={makeStats({ totalRootCpuTime: 100, profilingWindowSpan: 320 })}
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={1}
      />,
    );

    expect(screen.getByText('60.0%')).toBeTruthy();
    expect(screen.getByText('15.0%')).toBeTruthy();
    expect(screen.getByText('P95 Self')).toBeTruthy();
    expect(screen.queryByText('P95 Inclusive')).toBeNull();
    expect(screen.getByText('Flamegraph')).toBeTruthy();
    expect(screen.getByText('Tick')).toBeTruthy();
    expect(screen.getByText('Hot Nodes')).toBeTruthy();
    expect(screen.getByText('Window')).toBeTruthy();
    expect(screen.getByText('Sorted by: Total Self')).toBeTruthy();
    expect(screen.getByText('Total Ticks: 1')).toBeTruthy();
    expect(screen.getByText('Total Time: 100ms / 320ms')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show Inclusive metrics' }));
    expect(screen.getByText('P95 Inclusive')).toBeTruthy();
    expect(screen.getByText('100.0%')).toBeTruthy();
    expect(screen.getByText('25.0%')).toBeTruthy();
  });

  it('shows approximate percentile badge in live mode and hides it in paused mode', () => {
    const hotNodes: NodeProfilingData[] = [
      makeProfilingData({ nodeId: 1, totalCpuTime: 100, totalSelfCpuTime: 60, tickCount: 1 }),
    ];

    const { rerender } = render(
      <PerformanceView
        frames={[makeFrame({ nodeId: 1, inclusiveTime: 100, finishedAt: 100 })]}
        hotNodes={hotNodes}
        stats={makeStats({ totalRootCpuTime: 100, profilingWindowSpan: 320 })}
        percentilesApproximate
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={1}
      />,
    );

    expect(screen.getByText('Approx')).toBeTruthy();

    rerender(
      <PerformanceView
        frames={[makeFrame({ nodeId: 1, inclusiveTime: 100, finishedAt: 100 })]}
        hotNodes={hotNodes}
        stats={makeStats({ totalRootCpuTime: 100, profilingWindowSpan: 320 })}
        percentilesApproximate={false}
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={1}
      />,
    );

    expect(screen.queryByText('Approx')).toBeNull();
  });

  it('computes tick total from all root frames and uses it in flamegraph tooltip percent', () => {
    const onSelectNode = vi.fn();
    const frames: FlameGraphFrame[] = [
      makeFrame({ nodeId: 1, name: 'RootA', inclusiveTime: 10, finishedAt: 10 }),
      makeFrame({ nodeId: 2, name: 'RootB', inclusiveTime: 20, finishedAt: 20 }),
    ];

    const { container } = render(
      <PerformanceView
        frames={frames}
        hotNodes={[]}
        stats={makeStats()}
        onSelectNode={onSelectNode}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={7}
      />,
    );

    expect(screen.getByText('CPU: 30.0ms')).toBeTruthy();

    const firstBar = container.querySelector('.bt-flamegraph__bar');
    expect(firstBar).toBeTruthy();
    fireEvent.mouseMove(firstBar!, { clientX: 100, clientY: 80 });

    expect(screen.getByText('33.3%')).toBeTruthy();
  });

  it('sorts hot nodes by selected column in descending order', () => {
    const hotNodes: NodeProfilingData[] = [
      makeProfilingData({
        nodeId: 1,
        totalCpuTime: 100,
        totalSelfCpuTime: 50,
        selfCpuP95: 1,
        tickCount: 50,
      }),
      makeProfilingData({
        nodeId: 2,
        totalCpuTime: 90,
        totalSelfCpuTime: 20,
        selfCpuP95: 8,
        tickCount: 2,
      }),
    ];

    const { container } = render(
      <PerformanceView
        frames={[makeFrame()]}
        hotNodes={hotNodes}
        stats={makeStats({ totalRootCpuTime: 100 })}
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={1}
      />,
    );

    const getFirstRowText = () =>
      container.querySelectorAll('tbody tr')[0]?.textContent ?? '';

    expect(getFirstRowText()).toContain('Node 1');

    fireEvent.click(within(container).getByRole('button', { name: 'Show Inclusive metrics' }));
    fireEvent.click(within(container).getByRole('button', { name: 'Avg Self' }));
    expect(getFirstRowText()).toContain('Node 2');

    fireEvent.click(within(container).getByRole('button', { name: 'P95 Self' }));
    expect(getFirstRowText()).toContain('Node 2');
  });

  it('allows switching percentile and applies it to percentile columns and sorting', () => {
    const hotNodes: NodeProfilingData[] = [
      makeProfilingData({
        nodeId: 1,
        totalSelfCpuTime: 50,
        selfCpuP50: 1,
        selfCpuP95: 6,
        selfCpuP99: 8,
        cpuP50: 10,
        cpuP95: 4,
        cpuP99: 3,
        tickCount: 10,
      }),
      makeProfilingData({
        nodeId: 2,
        totalSelfCpuTime: 40,
        selfCpuP50: 5,
        selfCpuP95: 2,
        selfCpuP99: 9,
        cpuP50: 2,
        cpuP95: 7,
        cpuP99: 11,
        tickCount: 10,
      }),
    ];

    const { container } = render(
      <PerformanceView
        frames={[makeFrame()]}
        hotNodes={hotNodes}
        stats={makeStats({ totalRootCpuTime: 100 })}
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={1}
      />,
    );

    const getFirstRowText = () =>
      container.querySelectorAll('tbody tr')[0]?.textContent ?? '';

    fireEvent.click(within(container).getByRole('button', { name: 'P95 Self' }));
    expect(getFirstRowText()).toContain('Node 1');

    fireEvent.click(within(container).getByRole('button', { name: 'P50' }));
    expect(within(container).getByRole('button', { name: /P50 Self/ })).toBeTruthy();
    expect(getFirstRowText()).toContain('Node 2');

    fireEvent.click(within(container).getByRole('button', { name: 'Show Inclusive metrics' }));
    fireEvent.click(within(container).getByRole('button', { name: /P50 Inclusive/ }));
    expect(getFirstRowText()).toContain('Node 1');

    fireEvent.click(within(container).getByRole('button', { name: 'P99' }));
    expect(within(container).getByRole('button', { name: /P99 Inclusive/ })).toBeTruthy();
    expect(getFirstRowText()).toContain('Node 2');
  });

  it('cross-highlights hot node rows and flamegraph bars on hover', () => {
    const { container } = render(
      <PerformanceView
        frames={[makeFrame({ nodeId: 7, name: 'CrossNode', inclusiveTime: 30, finishedAt: 30 })]}
        hotNodes={[makeProfilingData({ nodeId: 7, totalCpuTime: 30, tickCount: 1 })]}
        stats={makeStats({ totalRootCpuTime: 30 })}
        onSelectNode={vi.fn()}
        selectedNodeId={null}
        treeIndex={null}
        viewedTickId={9}
      />,
    );

    const row = container.querySelector('tbody tr');
    const bar = container.querySelector('.bt-flamegraph__bar');
    expect(row).toBeTruthy();
    expect(bar).toBeTruthy();

    fireEvent.mouseEnter(row!);
    expect(bar!.getAttribute('class')).toContain('bt-flamegraph__bar--hovered');

    fireEvent.mouseMove(bar!, { clientX: 30, clientY: 20 });
    expect(row!.className).toContain('bt-hot-nodes__row--hovered');
  });
});
