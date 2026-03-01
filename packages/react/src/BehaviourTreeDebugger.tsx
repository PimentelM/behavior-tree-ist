import { useState, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { createPortal } from 'react-dom';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import { TreeInspector } from '@behavior-tree-ist/core/inspector';
import type { BehaviourTreeDebuggerProps, ThemeMode } from './types';
import { useInspector } from './hooks/useInspector';
import { useTreeLayout } from './hooks/useTreeLayout';
import { useSnapshotOverlay } from './hooks/useSnapshotOverlay';
import { useTimeTravelControls } from './hooks/useTimeTravelControls';
import { useNodeDetails } from './hooks/useNodeDetails';
import { usePerformanceData } from './hooks/usePerformanceData';
import { DebuggerLayout } from './components/DebuggerLayout';
import { TreeCanvas } from './components/TreeCanvas';
import { ToolbarPanel } from './components/panels/ToolbarPanel';
import { TimelinePanel } from './components/panels/TimelinePanel';
import { NodeDetailPanel } from './components/panels/NodeDetailPanel';
import { ActivityNowPanel } from './components/panels/ActivityNowPanel';
import { PerformanceView } from './components/panels/PerformanceView';
import { getResultColor } from './constants';
import { buildTheme, themeToCSSVars } from './styles/theme';
import type { ActivityBranchData } from './types';
import './styles/debugger.css';

const SHADOW_BASE_CSS = [
  ':host{display:block;box-sizing:border-box;}',
  ':host *,:host *::before,:host *::after{box-sizing:border-box;}',
].join('');
const ACTIVITY_WINDOW_PADDING = 8;

type ActivityWindowPosition = {
  x: number;
  y: number;
};

type ActivityDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
};

function collectDebuggerStyles(): string {
  if (typeof document === 'undefined') return '';

  const collected: string[] = [];
  const shouldInclude = (cssText: string) =>
    cssText.includes('.bt-')
    || cssText.includes('.react-flow')
    || cssText.includes('@keyframes bt-edge-dash');

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of Array.from(rules)) {
      if (shouldInclude(rule.cssText)) {
        collected.push(rule.cssText);
      }
    }
  }

  return `${SHADOW_BASE_CSS}${collected.join('\n')}`;
}

export function BehaviourTreeDebugger({
  tree,
  ticks,
  inspectorOptions,
  inspectorRef,
  panels = { nodeDetails: true, timeline: true, refTraces: true, activityNow: true },
  activityDisplayMode = 'running',
  theme: themeOverrides,
  themeMode: controlledThemeMode,
  defaultThemeMode = 'dark',
  onThemeModeChange,
  showThemeToggle = true,
  showToolbar = true,
  toolbarActions,
  layoutDirection = 'TB',
  width = '100%',
  height = '100%',
  isolateStyles = true,
  onNodeSelect,
  onTickChange,
  className,
}: BehaviourTreeDebuggerProps) {
  const activityWindowEnabled = panels.activityNow !== false;
  const [internalThemeMode, setInternalThemeMode] = useState<ThemeMode>(defaultThemeMode);
  const themeMode = controlledThemeMode ?? internalThemeMode;
  const theme = useMemo(() => buildTheme(themeMode, themeOverrides), [themeMode, themeOverrides]);
  const cssVars = useMemo(() => themeToCSSVars(theme), [theme]);

  useEffect(() => {
    setInternalThemeMode(defaultThemeMode);
  }, [defaultThemeMode]);

  const { inspector, tickGeneration } = useInspector(tree, ticks, inspectorOptions);

  // Expose inspector via ref
  useEffect(() => {
    if (inspectorRef) {
      inspectorRef.current = inspector;
    }
  }, [inspector, inspectorRef]);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [openDetailsSignal, setOpenDetailsSignal] = useState(0);
  const [centerTreeSignal, setCenterTreeSignal] = useState(0);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);
  const [focusNodeSignal, setFocusNodeSignal] = useState(0);
  const [pausedInspector, setPausedInspector] = useState<TreeInspector | null>(null);
  const [timeFormatOverride, setTimeFormatOverride] = useState<boolean | null>(null);
  const [activityWindowVisible, setActivityWindowVisible] = useState(activityWindowEnabled);
  const [activityWindowCollapsed, setActivityWindowCollapsed] = useState(false);
  const [selectedActivityTailNodeId, setSelectedActivityTailNodeId] = useState<number | null>(null);
  const [activityWindowPosition, setActivityWindowPosition] = useState<ActivityWindowPosition | null>(null);
  const canvasSurfaceRef = useRef<HTMLDivElement | null>(null);
  const activityWindowRef = useRef<HTMLDivElement | null>(null);
  const activityDragRef = useRef<ActivityDragState | null>(null);

  useEffect(() => {
    setPausedInspector(null);
  }, [tree]);

  useEffect(() => {
    setSelectedActivityTailNodeId(null);
  }, [tree]);

  useEffect(() => {
    if (!activityWindowEnabled) {
      setActivityWindowVisible(false);
    } else {
      setActivityWindowVisible(true);
    }
  }, [activityWindowEnabled]);

  const timeTravelControls = useTimeTravelControls(pausedInspector ?? inspector, tickGeneration);
  const { viewedTickId } = timeTravelControls;
  const displayTimeAsTimestamp = timeFormatOverride ?? (timeTravelControls.nowIsTimestamp ?? false);

  useEffect(() => {
    if (timeTravelControls.mode === 'live') {
      setPausedInspector(null);
      return;
    }

    if (pausedInspector) return;

    const frozen = inspector.cloneForTimeTravel({ exactPercentiles: true });
    setPausedInspector(frozen);
  }, [timeTravelControls.mode, pausedInspector, inspector]);

  const activeInspector = pausedInspector ?? inspector;
  const percentilesApproximate = timeTravelControls.mode === 'live';

  // Layout: only recomputes when tree changes
  const { nodes: baseNodes, edges: baseEdges } = useTreeLayout(
    activeInspector.tree,
    layoutDirection,
  );

  useEffect(() => {
    if (baseNodes.length === 0) return;

    const hasSelectedNode = selectedNodeId !== null
      && baseNodes.some((node) => node.data.representedNodeIds.includes(selectedNodeId));
    if (hasSelectedNode) return;

    const rootNodeId = baseNodes[0]?.data.nodeId;
    if (rootNodeId === undefined) return;

    setSelectedNodeId(rootNodeId);
    onNodeSelect?.(rootNodeId);
  }, [baseNodes, selectedNodeId, onNodeSelect]);

  const layoutVersion = useMemo(
    () => `${layoutDirection}:${baseNodes.length}:${baseEdges.length}`,
    [layoutDirection, baseNodes.length, baseEdges.length],
  );

  const refEventsByNode = useMemo(() => {
    const byNode = new Map<number, RefChangeEvent[]>();
    if (viewedTickId === null) return byNode;
    const records = activeInspector.getTickRange(viewedTickId, viewedTickId);
    for (const record of records) {
      for (const event of record.refEvents) {
        if (event.nodeId === undefined) continue;
        const list = byNode.get(event.nodeId) ?? [];
        list.push(event);
        byNode.set(event.nodeId, list);
      }
    }
    return byNode;
  }, [activeInspector, viewedTickId]);

  const handleSelectNode = useCallback((nodeId: number) => {
    setSelectedActivityTailNodeId(null);
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  const handleFocusActorNode = useCallback((nodeId: number) => {
    setSelectedActivityTailNodeId(null);
    setSelectedNodeId(nodeId);
    setFocusNodeId(nodeId);
    setFocusNodeSignal((value) => value + 1);
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  // Node details for sidebar
  const nodeDetails = useNodeDetails(activeInspector, selectedNodeId, viewedTickId, tickGeneration);

  // Performance data for flamegraph/hot nodes
  const performanceData = usePerformanceData(activeInspector, viewedTickId, tickGeneration, performanceMode);

  // Collect ref events across all stored ticks for the ref details panel
  const refEvents = useMemo(() => {
    const tickIds = activeInspector.getStoredTickIds();
    if (tickIds.length === 0) return [];

    const oldestTickId = tickIds[0];
    const newestTickId = tickIds[tickIds.length - 1];
    if (oldestTickId === undefined || newestTickId === undefined) return [];

    const events: RefChangeEvent[] = [];
    const range = activeInspector.getTickRange(oldestTickId, newestTickId);
    for (const record of range) {
      for (const event of record.refEvents) {
        events.push(event);
      }
    }
    return events;
  }, [activeInspector, tickGeneration]);

  const activityBranches = useMemo(() => {
    const inspectorWithActivity = activeInspector as TreeInspector & {
      getLatestActivitySnapshot?: (mode?: 'running' | 'running_or_success' | 'all') => { branches: readonly ActivityBranchData[] } | undefined;
      getActivitySnapshotAtTick?: (tickId: number, mode?: 'running' | 'running_or_success' | 'all') => { branches: readonly ActivityBranchData[] } | undefined;
    };
    const snapshot = viewedTickId === null
      ? inspectorWithActivity.getLatestActivitySnapshot?.(activityDisplayMode)
      : inspectorWithActivity.getActivitySnapshotAtTick?.(viewedTickId, activityDisplayMode);
    return snapshot?.branches ?? [];
  }, [activeInspector, viewedTickId, activityDisplayMode, tickGeneration]);

  useEffect(() => {
    if (selectedActivityTailNodeId === null) return;
    const exists = activityBranches.some((branch) => branch.tailNodeId === selectedActivityTailNodeId);
    if (!exists) {
      setSelectedActivityTailNodeId(null);
    }
  }, [activityBranches, selectedActivityTailNodeId]);

  const selectedActivityBranch = useMemo(
    () => activityBranches.find((branch) => branch.tailNodeId === selectedActivityTailNodeId),
    [activityBranches, selectedActivityTailNodeId],
  );

  const selectedActivityPathNodeIds = selectedActivityBranch?.pathNodeIds;
  const selectedActivityTailForHighlight = selectedActivityBranch?.tailNodeId ?? null;

  // Overlay snapshot data onto nodes
  const { nodes, edges } = useSnapshotOverlay(
    baseNodes,
    baseEdges,
    activeInspector,
    viewedTickId,
    selectedNodeId,
    selectedActivityPathNodeIds,
    selectedActivityTailForHighlight,
    refEventsByNode,
    handleSelectNode,
    tickGeneration,
  );

  const handleSelectActivityBranch = useCallback((branch: ActivityBranchData) => {
    setSelectedActivityTailNodeId(branch.tailNodeId);
    setSelectedNodeId(branch.tailNodeId);
    setFocusNodeId(branch.tailNodeId);
    setFocusNodeSignal((value) => value + 1);
    onNodeSelect?.(branch.tailNodeId);
  }, [onNodeSelect]);

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      handleSelectNode(nodeId);
      setOpenDetailsSignal((value) => value + 1);
    },
    [handleSelectNode],
  );

  const handleGoToTick = useCallback(
    (tickId: number) => {
      timeTravelControls.goToTick(tickId);
      onTickChange?.(tickId);
    },
    [timeTravelControls, onTickChange],
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tagName = target.tagName;
      return target.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT';
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code === 'Space' || event.key === ' ') && !event.repeat) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();

        if (timeTravelControls.mode === 'paused') {
          timeTravelControls.jumpToLive();
          const liveNewest = inspector.getStats().newestTickId;
          if (liveNewest !== undefined) {
            onTickChange?.(liveNewest);
          }
          return;
        }

        timeTravelControls.pause();
        const liveNewest = inspector.getStats().newestTickId;
        if (liveNewest !== undefined) {
          onTickChange?.(liveNewest);
        }
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (isEditableTarget(event.target)) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          timeTravelControls.stepBack();
        } else {
          if (timeTravelControls.mode !== 'paused') return;
          event.preventDefault();
          timeTravelControls.stepForward();
        }
        return;
      }

      if (event.key !== 'Escape') return;
      if (timeTravelControls.mode !== 'paused') return;
      timeTravelControls.jumpToLive();
      if (timeTravelControls.newestTickId !== undefined) {
        onTickChange?.(timeTravelControls.newestTickId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [timeTravelControls, inspector, onTickChange]);

  const handleToggleTheme = useCallback(() => {
    const nextMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    if (controlledThemeMode === undefined) {
      setInternalThemeMode(nextMode);
    }
    onThemeModeChange?.(nextMode);
  }, [themeMode, controlledThemeMode, onThemeModeChange]);

  const handleCenterTree = useCallback(() => {
    setCenterTreeSignal((value) => value + 1);
  }, []);

  const handleTogglePerformanceMode = useCallback(() => {
    setPerformanceMode((v) => !v);
  }, []);

  const handleToggleTimeTravel = useCallback(() => {
    if (timeTravelControls.mode === 'paused') {
      timeTravelControls.jumpToLive();
      const liveNewest = inspector.getStats().newestTickId;
      if (liveNewest !== undefined) {
        onTickChange?.(liveNewest);
      }
      return;
    }

    timeTravelControls.pause();
    const liveNewest = inspector.getStats().newestTickId;
    if (liveNewest !== undefined) {
      onTickChange?.(liveNewest);
    }
  }, [timeTravelControls, inspector, onTickChange]);

  const handleToggleTimeFormat = useCallback(() => {
    const current = timeFormatOverride ?? (timeTravelControls.nowIsTimestamp ?? false);
    setTimeFormatOverride(!current);
  }, [timeFormatOverride, timeTravelControls.nowIsTimestamp]);

  const handleToggleActivityWindow = useCallback(() => {
    setActivityWindowVisible((visible) => !visible);
  }, []);

  const handleCloseActivityWindow = useCallback(() => {
    setActivityWindowVisible(false);
    setSelectedActivityTailNodeId(null);
  }, []);

  const handleToggleActivityWindowCollapsed = useCallback(() => {
    setActivityWindowCollapsed((collapsed) => !collapsed);
  }, []);

  const clampActivityWindowPosition = useCallback((x: number, y: number): ActivityWindowPosition => {
    const surface = canvasSurfaceRef.current;
    const panel = activityWindowRef.current;
    if (!surface || !panel) {
      return {
        x: Math.max(ACTIVITY_WINDOW_PADDING, x),
        y: Math.max(ACTIVITY_WINDOW_PADDING, y),
      };
    }

    const maxX = Math.max(
      ACTIVITY_WINDOW_PADDING,
      surface.clientWidth - panel.offsetWidth - ACTIVITY_WINDOW_PADDING,
    );
    const maxY = Math.max(
      ACTIVITY_WINDOW_PADDING,
      surface.clientHeight - panel.offsetHeight - ACTIVITY_WINDOW_PADDING,
    );

    return {
      x: Math.min(Math.max(ACTIVITY_WINDOW_PADDING, x), maxX),
      y: Math.min(Math.max(ACTIVITY_WINDOW_PADDING, y), maxY),
    };
  }, []);

  useEffect(() => {
    if (!activityWindowEnabled || !activityWindowVisible || performanceMode) return;
    if (activityWindowPosition !== null) return;

    const frame = requestAnimationFrame(() => {
      const surface = canvasSurfaceRef.current;
      const panel = activityWindowRef.current;
      if (!surface || !panel) {
        setActivityWindowPosition({ x: ACTIVITY_WINDOW_PADDING, y: ACTIVITY_WINDOW_PADDING });
        return;
      }

      const initialX = Math.max(
        ACTIVITY_WINDOW_PADDING,
        surface.clientWidth - panel.offsetWidth - ACTIVITY_WINDOW_PADDING,
      );
      setActivityWindowPosition({ x: initialX, y: ACTIVITY_WINDOW_PADDING });
    });

    return () => cancelAnimationFrame(frame);
  }, [activityWindowEnabled, activityWindowVisible, performanceMode, activityWindowPosition]);

  useEffect(() => {
    if (activityWindowPosition === null) return;
    if (!activityWindowVisible || performanceMode) return;

    setActivityWindowPosition((current) => {
      if (!current) return current;
      const clamped = clampActivityWindowPosition(current.x, current.y);
      if (clamped.x === current.x && clamped.y === current.y) {
        return current;
      }
      return clamped;
    });
  }, [layoutVersion, showToolbar, clampActivityWindowPosition, activityWindowPosition, activityWindowVisible, performanceMode]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = activityDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const nextX = drag.startX + (event.clientX - drag.startClientX);
      const nextY = drag.startY + (event.clientY - drag.startClientY);
      setActivityWindowPosition(clampActivityWindowPosition(nextX, nextY));
    };

    const onPointerEnd = (event: PointerEvent) => {
      const drag = activityDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      activityDragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [clampActivityWindowPosition]);

  const handleActivityWindowDragStart = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const start = activityWindowPosition ?? { x: ACTIVITY_WINDOW_PADDING, y: ACTIVITY_WINDOW_PADDING };
    activityDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: start.x,
      startY: start.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [activityWindowPosition]);

  const handleActivityWindowControlPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const collapsedActivityBranch = useMemo(() => {
    const branch = activityBranches[activityBranches.length - 1];
    return branch;
  }, [activityBranches]);

  const collapsedActivityEntry = useMemo(() => {
    const branch = collapsedActivityBranch;
    if (!branch) return 'No activity';
    const label = branch.labels.join(' > ').trim();
    return label.length > 0 ? label : 'No activity';
  }, [collapsedActivityBranch]);

  const collapsedActivityResultColor = useMemo(
    () => getResultColor(collapsedActivityBranch?.tailResult),
    [collapsedActivityBranch],
  );

  const showSidebar = panels.nodeDetails !== false || panels.refTraces !== false;
  const showTimeline = panels.timeline !== false;
  const showRefTraces = panels.refTraces !== false;
  const showPerformance = panels.performance !== false;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const [shadowStyles, setShadowStyles] = useState('');

  useEffect(() => {
    if (!isolateStyles || !hostRef.current) return;
    const root = hostRef.current.shadowRoot ?? hostRef.current.attachShadow({ mode: 'open' });
    setShadowRoot(root);
  }, [isolateStyles]);

  useEffect(() => {
    if (!isolateStyles) return;

    const syncStyles = () => setShadowStyles(collectDebuggerStyles());
    syncStyles();

    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [isolateStyles]);

  const content = (
    <ReactFlowProvider>
      <DebuggerLayout
        showSidebar={showSidebar}
        showTimeline={showTimeline}
        showToolbar={showToolbar}
        toolbar={
          showToolbar ? (
            <ToolbarPanel
              showSidebar={showSidebar}
              actions={toolbarActions}
              showThemeToggle={showThemeToggle}
              themeMode={themeMode}
              onToggleTheme={handleToggleTheme}
              onCenterTree={handleCenterTree}
              timeTravelMode={timeTravelControls.mode}
              viewedTickId={viewedTickId}
              viewedNow={timeTravelControls.viewedNow}
              displayTimeAsTimestamp={displayTimeAsTimestamp}
              onToggleTimeFormat={handleToggleTimeFormat}
              onToggleTimeTravel={handleToggleTimeTravel}
              performanceMode={performanceMode}
              onTogglePerformanceMode={showPerformance ? handleTogglePerformanceMode : undefined}
              activityWindowEnabled={activityWindowEnabled}
              activityWindowVisible={activityWindowVisible}
              onToggleActivityWindow={activityWindowEnabled ? handleToggleActivityWindow : undefined}
            />
          ) : null
        }
        canvas={
          <div className="bt-canvas-surface" ref={canvasSurfaceRef}>
            {performanceMode ? (
              <PerformanceView
                frames={performanceData.frames}
                hotNodes={performanceData.hotNodes}
                stats={performanceData.stats}
                percentilesApproximate={percentilesApproximate}
                onSelectNode={handleNodeClick}
                selectedNodeId={selectedNodeId}
                treeIndex={activeInspector.tree ?? null}
                viewedTickId={viewedTickId}
              />
            ) : (
              <TreeCanvas
                nodes={nodes}
                edges={edges}
                layoutVersion={layoutVersion}
                centerTreeSignal={centerTreeSignal}
                focusNodeId={focusNodeId}
                focusNodeSignal={focusNodeSignal}
                onNodeClick={handleNodeClick}
              />
            )}

            {!performanceMode && activityWindowEnabled && activityWindowVisible && (
              <div
                className={`bt-canvas-surface__activity ${activityWindowCollapsed ? 'bt-canvas-surface__activity--collapsed' : ''}`}
                ref={activityWindowRef}
                style={{
                  transform: `translate(${activityWindowPosition?.x ?? ACTIVITY_WINDOW_PADDING}px, ${activityWindowPosition?.y ?? ACTIVITY_WINDOW_PADDING}px)`,
                }}
              >
                <div
                  className="bt-canvas-surface__activity-header"
                  onPointerDown={handleActivityWindowDragStart}
                  title="Drag current activity window"
                >
                  {activityWindowCollapsed ? (
                    <span className="bt-canvas-surface__activity-title">
                      <span>Current Activity:</span>
                      <span className="bt-canvas-surface__activity-summary">
                        <span
                          className="bt-canvas-surface__activity-summary-dot"
                          style={{ backgroundColor: collapsedActivityResultColor }}
                          aria-hidden="true"
                        />
                        <span className="bt-canvas-surface__activity-summary-text">{collapsedActivityEntry}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="bt-canvas-surface__activity-title">Current Activity</span>
                  )}
                  <div className="bt-canvas-surface__activity-controls">
                    <button
                      type="button"
                      className="bt-canvas-surface__activity-control"
                      onPointerDown={handleActivityWindowControlPointerDown}
                      onClick={handleCloseActivityWindow}
                      aria-label="Close current activity window"
                      title="Close current activity window"
                    >
                      ×
                    </button>
                    <button
                      type="button"
                      className="bt-canvas-surface__activity-control"
                      onPointerDown={handleActivityWindowControlPointerDown}
                      onClick={handleToggleActivityWindowCollapsed}
                      aria-label={activityWindowCollapsed ? 'Expand current activity window' : 'Collapse current activity window'}
                      title={activityWindowCollapsed ? 'Expand current activity window' : 'Collapse current activity window'}
                    >
                      {activityWindowCollapsed ? '▾' : '-'}
                    </button>
                  </div>
                </div>
                {!activityWindowCollapsed && (
                  <ActivityNowPanel
                    branches={activityBranches}
                    onSelectBranch={handleSelectActivityBranch}
                    variant="floating"
                    showTitle={false}
                  />
                )}
              </div>
            )}
          </div>
        }
        sidebar={
          showSidebar ? (
            <NodeDetailPanel
              details={nodeDetails}
              refEvents={refEvents}
              viewedTickId={viewedTickId}
              percentilesApproximate={percentilesApproximate}
              openDetailsSignal={openDetailsSignal}
              showRefTraces={showRefTraces}
              onGoToTick={handleGoToTick}
              onFocusActorNode={handleFocusActorNode}
            />
          ) : null
        }
        timeline={
          showTimeline ? (
            <TimelinePanel
              controls={timeTravelControls}
              displayTimeAsTimestamp={displayTimeAsTimestamp}
              onTickChange={onTickChange}
            />
          ) : null
        }
      />
    </ReactFlowProvider>
  );

  if (!isolateStyles) {
    const containerStyle: React.CSSProperties = {
      width,
      height,
      ...cssVars as React.CSSProperties,
    };

    return (
      <div
        className={`bt-debugger bt-debugger--${themeMode} ${className ?? ''}`}
        style={containerStyle}
      >
        {content}
      </div>
    );
  }

  const hostStyle: React.CSSProperties = {
    width,
    height,
    display: 'block',
  };

  const isolatedContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    ...cssVars as React.CSSProperties,
  };

  return (
    <div className={className} style={hostStyle} ref={hostRef}>
      {shadowRoot
        ? createPortal(
          <>
            <style>{shadowStyles}</style>
            <div className={`bt-debugger bt-debugger--${themeMode}`} style={isolatedContainerStyle}>
              {content}
            </div>
          </>,
          shadowRoot,
        )
        : null}
    </div>
  );
}
