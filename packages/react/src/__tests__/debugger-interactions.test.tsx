import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { NodeResult, NodeFlags } from '@bt-studio/core';
import type { RefChangeEvent } from '@bt-studio/core';
import type { NodeDetailsData } from '../types';
import type { FlameGraphFrame, NodeProfilingData, TreeStats } from '@bt-studio/core/inspector';
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      (btn) => btn.textContent?.includes('health') && btn.textContent?.includes('tick #5'),
    );
    expect(refButton).toBeTruthy();

    fireEvent.click(refButton as HTMLElement);

    expect(onGoToTick).toHaveBeenCalledWith(5);
    expect(onFocusActorNode).toHaveBeenCalledWith(42);
  });

  it('groups refs with dot-notation prefix under a group header in last known states', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'player.health', newValue: 100 }),
      makeRefEvent({ tickId: 2, refName: 'player.mana', newValue: 50 }),
      makeRefEvent({ tickId: 3, refName: 'simpleRef', newValue: 42 }),
    ];

    const { container } = render(
      <RefTracesPanel
        events={events}
        viewedTickId={null}
        onGoToTick={vi.fn()}
        onFocusActorNode={vi.fn()}
      />,
    );

    // Group header "player" should be visible
    expect(screen.getByText('player')).toBeTruthy();

    // Suffixes shown in group entries (not full names)
    const stateList = container.querySelector('.bt-ref-traces__state-list');
    expect(stateList).toBeTruthy();
    const stateNames = Array.from(
      (stateList as Element).querySelectorAll('.bt-ref-traces__state-name'),
    ).map((el) => el.textContent);
    expect(stateNames).toContain('health');
    expect(stateNames).toContain('mana');
    expect(stateNames).toContain('simpleRef');
    expect(stateNames).not.toContain('player.health');
    expect(stateNames).not.toContain('player.mana');
  });

  it('shows ungrouped refs without a group header', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'alpha', newValue: 1 }),
      makeRefEvent({ tickId: 2, refName: 'beta', newValue: 2 }),
    ];

    const { container } = render(
      <RefTracesPanel
        events={events}
        viewedTickId={null}
        onGoToTick={vi.fn()}
        onFocusActorNode={vi.fn()}
      />,
    );

    expect(container.querySelector('.bt-ref-traces__group-header')).toBeNull();
    expect(container.querySelector('.bt-ref-traces__group')).toBeNull();
  });

  it('calls onGoToTick and onFocusActorNode when clicking a grouped state entry', () => {
    const onGoToTick = vi.fn();
    const onFocusActorNode = vi.fn();

    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 7, nodeId: 99, refName: 'enemy.health', newValue: 80 }),
    ];

    const { container } = render(
      <RefTracesPanel
        events={events}
        viewedTickId={null}
        onGoToTick={onGoToTick}
        onFocusActorNode={onFocusActorNode}
      />,
    );

    const stateEntry = container.querySelector('.bt-ref-traces__state-entry');
    expect(stateEntry).toBeTruthy();
    fireEvent.click(stateEntry as Element);

    expect(onGoToTick).toHaveBeenCalledWith(7);
    expect(onFocusActorNode).toHaveBeenCalledWith(99);
  });

  it('collapses and expands a group when its header button is clicked', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'combat.target', newValue: 'goblin' }),
      makeRefEvent({ tickId: 2, refName: 'combat.weapon', newValue: 'sword' }),
    ];

    const { container } = render(
      <RefTracesPanel
        events={events}
        viewedTickId={null}
        onGoToTick={vi.fn()}
        onFocusActorNode={vi.fn()}
      />,
    );

    const groupHeader = container.querySelector('.bt-ref-traces__group-header');
    expect(groupHeader).toBeTruthy();
    expect(container.querySelector('.bt-ref-traces__group-children')).toBeTruthy();

    fireEvent.click(groupHeader as Element);
    expect(container.querySelector('.bt-ref-traces__group-children')).toBeNull();

    fireEvent.click(groupHeader as Element);
    expect(container.querySelector('.bt-ref-traces__group-children')).toBeTruthy();
  });

  it('disclosure triangle has expanded class when open and loses it when collapsed', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'npc.health', newValue: 90 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    const toggle = container.querySelector('.bt-ref-traces__group-toggle');
    expect(toggle?.classList.contains('bt-ref-traces__group-toggle--expanded')).toBe(true);

    fireEvent.click(container.querySelector('.bt-ref-traces__group-header') as Element);

    expect(toggle?.classList.contains('bt-ref-traces__group-toggle--expanded')).toBe(false);
  });

  it('count badge shows correct member count for group', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'player.health', newValue: 100 }),
      makeRefEvent({ tickId: 2, refName: 'player.mana', newValue: 50 }),
      makeRefEvent({ tickId: 3, refName: 'player.stamina', newValue: 30 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(container.querySelector('.bt-ref-traces__group-count')?.textContent).toBe('(3)');
  });

  it('ungrouped refs appear before grouped refs in the state list', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'group.member', newValue: 1 }),
      makeRefEvent({ tickId: 2, refName: 'standalone', newValue: 2 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    const stateList = container.querySelector('.bt-ref-traces__state-list');
    expect(stateList?.firstElementChild?.classList.contains('bt-ref-traces__group')).toBe(false);
    expect(container.querySelector('.bt-ref-traces__group')).toBeTruthy();
  });

  it('single-child group renders with group header and count badge showing 1', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'solo.only', newValue: 'x' }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(container.querySelector('.bt-ref-traces__group-header')).toBeTruthy();
    expect(container.querySelector('.bt-ref-traces__group-count')?.textContent).toBe('(1)');
  });

  it('deeply nested dot names use only first dot segment as prefix and rest as suffix', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'a.b.c.d', newValue: 1 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(screen.getByText('a')).toBeTruthy();
    expect(container.querySelector('.bt-ref-traces__state-name')?.textContent).toBe('b.c.d');
  });

  it('special characters in ref name prefix do not break grouping', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'ai-npc.health', newValue: 75 }),
      makeRefEvent({ tickId: 2, refName: 'ai-npc.ammo', newValue: 30 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(screen.getByText('ai-npc')).toBeTruthy();
    expect(container.querySelector('.bt-ref-traces__group-count')?.textContent).toBe('(2)');

    const names = Array.from(container.querySelectorAll('.bt-ref-traces__state-name')).map((el) => el.textContent);
    expect(names).toContain('health');
    expect(names).toContain('ammo');
  });

  it('collapse state persists when viewedTickId changes for time travel', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'monster.hp', newValue: 100 }),
      makeRefEvent({ tickId: 3, refName: 'monster.hp', newValue: 80 }),
    ];

    const { container, rerender } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    fireEvent.click(container.querySelector('.bt-ref-traces__group-header') as Element);
    expect(container.querySelector('.bt-ref-traces__group-children')).toBeNull();

    rerender(
      <RefTracesPanel events={events} viewedTickId={3} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(container.querySelector('.bt-ref-traces__group-children')).toBeNull();
  });

  it('time-travel viewedTickId filters latest states to events at or before that tick', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'counter', newValue: 10 }),
      makeRefEvent({ tickId: 5, refName: 'counter', newValue: 20 }),
      makeRefEvent({ tickId: 10, refName: 'counter', newValue: 30 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={5} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    const stateEntry = container.querySelector('.bt-ref-traces__state-entry');
    expect(stateEntry?.querySelector('.bt-ref-traces__value')?.textContent).toBe('20');
  });

  it('stale dot indicates whether event tick is behind viewedTickId', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 3, refName: 'hp', newValue: 50 }),
      makeRefEvent({ tickId: 5, refName: 'mp', newValue: 20 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={5} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    expect(container.querySelectorAll('.bt-ref-traces__stale-dot--stale').length).toBe(1);
    expect(container.querySelectorAll('.bt-ref-traces__stale-dot--fresh').length).toBe(1);
  });

  it('multiple groups collapse and expand independently', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'enemy.health', newValue: 100 }),
      makeRefEvent({ tickId: 2, refName: 'player.health', newValue: 80 }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    const headers = container.querySelectorAll('.bt-ref-traces__group-header');
    expect(headers.length).toBe(2);

    fireEvent.click(headers[0]);
    expect(container.querySelectorAll('.bt-ref-traces__group-children').length).toBe(1);

    fireEvent.click(headers[0]);
    expect(container.querySelectorAll('.bt-ref-traces__group-children').length).toBe(2);
  });

  it('state entry with no nodeId calls onGoToTick but not onFocusActorNode', () => {
    const onGoToTick = vi.fn();
    const onFocusActorNode = vi.fn();
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 5, refName: 'flag', nodeId: undefined }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={onGoToTick} onFocusActorNode={onFocusActorNode} />,
    );

    fireEvent.click(container.querySelector('.bt-ref-traces__state-entry') as Element);

    expect(onGoToTick).toHaveBeenCalledWith(5);
    expect(onFocusActorNode).not.toHaveBeenCalled();
  });

  it('displayValue takes precedence over newValue in state entry display', () => {
    const events: RefChangeEvent[] = [
      makeRefEvent({ tickId: 1, refName: 'flag', newValue: 42, displayValue: 'custom display' }),
    ];

    const { container } = render(
      <RefTracesPanel events={events} viewedTickId={null} onGoToTick={vi.fn()} onFocusActorNode={vi.fn()} />,
    );

    const stateEntry = container.querySelector('.bt-ref-traces__state-entry');
    expect(stateEntry?.textContent).toContain('custom display');
    expect(stateEntry?.textContent).not.toContain('42');
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
    fireEvent.mouseMove(firstBar as Element, { clientX: 100, clientY: 80 });

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

    fireEvent.mouseEnter(row as Element);
    expect((bar as Element).getAttribute('class')).toContain('bt-flamegraph__bar--hovered');

    fireEvent.mouseMove(bar as Element, { clientX: 30, clientY: 20 });
    expect((row as Element).className).toContain('bt-hot-nodes__row--hovered');
  });
});
