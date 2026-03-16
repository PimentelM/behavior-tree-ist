import { useState, useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { createPortal } from 'react-dom';
import type { RefChangeEvent } from '@bt-studio/core';
import { type TreeInspector } from '@bt-studio/core/inspector';
import type { BehaviourTreeDebuggerProps, ThemeMode } from './types';
import { useInspector } from './hooks/useInspector';
import { useTreeLayout } from './hooks/useTreeLayout';
import { useSnapshotOverlay } from './hooks/useSnapshotOverlay';
import { useTimeTravelControls } from './hooks/useTimeTravelControls';
import { useNodeDetails } from './hooks/useNodeDetails';
import { usePerformanceData } from './hooks/usePerformanceData';
import { useTimelineCpuData } from './hooks/useTimelineCpuData';
import { DebuggerLayout } from './components/DebuggerLayout';
import { TreeCanvas } from './components/TreeCanvas';
import { ToolbarPanel } from './components/panels/ToolbarPanel';
import { TimelinePanel } from './components/panels/TimelinePanel';
import { NodeDetailPanel } from './components/panels/NodeDetailPanel';
import { ActivityNowPanel } from './components/panels/ActivityNowPanel';
import { PerformanceView } from './components/panels/PerformanceView';
import { buildStudioToolbarFragments } from './components/studio/StudioToolbarControls';
import { AttachDrawer } from './components/studio/AttachDrawer';
import { SettingsPanel } from './components/studio/SettingsPanel';
import { getResultColor } from './constants';
import { buildTheme, themeToCSSVars } from './styles/theme';
import type { ActivityBranchData } from './types';
import './styles/debugger.css';

const SHADOW_BASE_CSS = [
  ':host{display:block;box-sizing:border-box;}',
  ':host *,:host *::before,:host *::after{box-sizing:border-box;}',
].join('');
const ACTIVITY_WINDOW_PADDING = 8;
const ACTIVITY_COLLAPSED_STORAGE_KEY = 'bt-activity-window-collapsed';
const SUBTREE_COLLAPSED_STORAGE_PREFIX = 'bt-collapsed-subtrees-';
type ActivityLabelMode = 'activity' | 'node';

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
    || cssText.includes('.xterm')
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
  replPanel,
  layoutDirection = 'TB',
  width = '100%',
  height = '100%',
  isolateStyles = true,
  onNodeSelect,
  onTickChange,
  className,
  studioControls,
  emptyState,
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
  const [replMode, setReplMode] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);
  const [focusNodeSignal, setFocusNodeSignal] = useState(0);
  const [pausedInspector, setPausedInspector] = useState<TreeInspector | null>(null);
  const [frozenByteTimeline, setFrozenByteTimeline] = useState<Array<{ tickId: number; bytes: number }> | null>(null);
  const byteMetricsSamplesRef = useRef(studioControls?.byteMetrics?.samples ?? null);
  byteMetricsSamplesRef.current = studioControls?.byteMetrics?.samples ?? null;
  const [timeFormatOverride, setTimeFormatOverride] = useState<boolean | null>(null);
  const [activityWindowVisible, setActivityWindowVisible] = useState(activityWindowEnabled);
  const [activityWindowCollapsed, setActivityWindowCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(ACTIVITY_COLLAPSED_STORAGE_KEY);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [activityOptionsCollapsed, setActivityOptionsCollapsed] = useState(true);
  const [selectedActivityTailNodeId, setSelectedActivityTailNodeId] = useState<number | null>(null);
  const [activityModeState, setActivityModeState] = useState(activityDisplayMode);
  const [activityLabelMode, setActivityLabelMode] = useState<ActivityLabelMode>('activity');
  const [activityWindowPosition, setActivityWindowPosition] = useState<ActivityWindowPosition | null>(null);
  const [studioDrawerOpen, setStudioDrawerOpen] = useState(false);
  const [studioSettingsOpen, setStudioSettingsOpen] = useState(false);
  const canvasSurfaceRef = useRef<HTMLDivElement | null>(null);
  const activityWindowRef = useRef<HTMLDivElement | null>(null);
  const activityDragRef = useRef<ActivityDragState | null>(null);

  const treeId = tree.id;
  const subtreeStorageKey = `${SUBTREE_COLLAPSED_STORAGE_PREFIX}${treeId}`;

  const [collapsedSubTrees, setCollapsedSubTrees] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(subtreeStorageKey);
      if (stored) return new Set(JSON.parse(stored) as number[]);
    } catch { /* ignore */ }
    return new Set();
  });

  // Reset collapsed subtrees on tree change, load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(subtreeStorageKey);
      if (stored) {
        setCollapsedSubTrees(new Set(JSON.parse(stored) as number[]));
        return;
      }
    } catch { /* ignore */ }
    setCollapsedSubTrees(new Set());
  }, [subtreeStorageKey]);

  const toggleSubTreeCollapse = useCallback((nodeId: number) => {
    setCollapsedSubTrees((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try { localStorage.setItem(subtreeStorageKey, JSON.stringify([...collapsedSubTrees])); } catch { /* ignore */ }
  }, [subtreeStorageKey, collapsedSubTrees]);

  useEffect(() => {
    setPausedInspector(null);
    setSelectedActivityTailNodeId(null);
  }, [tree]);

  useEffect(() => {
    if (!activityWindowEnabled) {
      setActivityWindowVisible(false);
    } else {
      setActivityWindowVisible(true);
    }
  }, [activityWindowEnabled]);

  useEffect(() => {
    setActivityModeState(activityDisplayMode);
  }, [activityDisplayMode]);

  const handleNeedTick = useCallback((tickId: number) => {
    studioControls?.onFetchTicksAround?.(tickId);
  }, [studioControls]);

  const timeTravelControls = useTimeTravelControls(pausedInspector ?? inspector, tickGeneration, {
    onNeedTick: studioControls ? handleNeedTick : undefined,
    serverBounds: studioControls?.tickBounds ?? null,
    isLoading: studioControls?.isLoadingWindow ?? false,
  });
  const { viewedTickId, navigateToTick } = timeTravelControls;

  const handleSelectRange = useCallback((from: number, to: number) => {
    studioControls?.onFetchTickRange?.(from, to);
  }, [studioControls]);
  const displayTimeAsTimestamp = timeFormatOverride ?? (timeTravelControls.nowIsTimestamp ?? false);

  const prevModeRef = useRef(timeTravelControls.mode);
  const prevIsLoadingWindowRef = useRef(studioControls?.isLoadingWindow ?? false);
  useEffect(() => {
    if (prevModeRef.current === 'paused' && timeTravelControls.mode === 'live') {
      studioControls?.onResumeStreaming?.();
    }
    prevModeRef.current = timeTravelControls.mode;
  }, [timeTravelControls.mode, studioControls]);

  useEffect(() => {
    if (timeTravelControls.mode === 'live') {
      setPausedInspector(null);
      setFrozenByteTimeline(null);
      return;
    }

    if (pausedInspector) return;
    if (studioControls?.isLoadingWindow) return;

    const frozen = inspector.cloneForTimeTravel({ exactPercentiles: true });
    setPausedInspector(frozen);
    const samples = byteMetricsSamplesRef.current;
    setFrozenByteTimeline(samples ? [...samples] : null);
  }, [timeTravelControls.mode, pausedInspector, inspector, studioControls?.isLoadingWindow]);

  // When a window fetch (seekToRange) completes while paused, the live inspector has been
  // cleared and re-ingested with the new range. Refresh pausedInspector so the scrubber
  // and time-travel controls reflect the new window.
  // useInspector's effects run before this one (hook called earlier in the component),
  // so inspector already holds the new ticks by the time this effect runs.
  useEffect(() => {
    const isLoading = studioControls?.isLoadingWindow ?? false;
    const wasLoading = prevIsLoadingWindowRef.current;
    prevIsLoadingWindowRef.current = isLoading;

    if (!isLoading && wasLoading && timeTravelControls.mode === 'paused') {
      setPausedInspector(inspector.cloneForTimeTravel({ exactPercentiles: true }));
      const samples = byteMetricsSamplesRef.current;
      setFrozenByteTimeline(samples ? [...samples] : null);
      // Auto-navigate to first tick of the new window; navigateToTick skips onNeedTick
      const oldest = inspector.getStats().oldestTickId;
      if (oldest !== undefined) {
        navigateToTick(oldest);
      }
    }
  }, [studioControls?.isLoadingWindow, timeTravelControls.mode, inspector, tickGeneration, navigateToTick]);

  const activeInspector = pausedInspector ?? inspector;
  const percentilesApproximate = timeTravelControls.mode === 'live';

  // Layout: only recomputes when tree changes or collapse state changes
  const { nodes: baseNodes, edges: baseEdges } = useTreeLayout(
    activeInspector.tree,
    layoutDirection,
    collapsedSubTrees,
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

  // CPU timeline data for sparkline in timeline panel
  const cpuTimeline = useTimelineCpuData(activeInspector, tickGeneration);

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
      ? inspectorWithActivity.getLatestActivitySnapshot(activityModeState)
      : inspectorWithActivity.getActivitySnapshotAtTick(viewedTickId, activityModeState);
    return snapshot?.branches ?? [];
  }, [activeInspector, viewedTickId, activityModeState, tickGeneration]);

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
    toggleSubTreeCollapse,
  );

  const handleSelectActivityBranch = useCallback((branch: ActivityBranchData) => {
    setSelectedActivityTailNodeId(branch.tailNodeId);
    setSelectedNodeId(branch.tailNodeId);
    setFocusNodeId(branch.tailNodeId);
    setFocusNodeSignal((value) => value + 1);
    onNodeSelect?.(branch.tailNodeId);
  }, [onNodeSelect]);

  const getActivityBranchText = useCallback((branch: ActivityBranchData): string => {
    if (activityLabelMode === 'activity') {
      return branch.labels.join(' > ');
    }

    const treeIndex = activeInspector.tree;
    if (!treeIndex) return branch.labels.join(' > ');

    const names = branch.nodeIds.map((nodeId) => {
      const node = treeIndex.getById(nodeId);
      if (!node) return `#${nodeId}`;
      const customName = node.name.trim();
      return customName.length > 0 ? customName : node.defaultName;
    });

    return names.join(' > ');
  }, [activityLabelMode, activeInspector.tree]);

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

  useEffect(() => {
    const isEditableElement = (el: unknown): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tagName = el.tagName;
      return el.isContentEditable
        || tagName === 'INPUT'
        || tagName === 'TEXTAREA'
        || tagName === 'SELECT';
    };
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (isEditableElement(target)) return true;
      let active: Element | null = document.activeElement;
      while (active?.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
      }
      return isEditableElement(active);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (replMode) return;
      if ((event.code === 'Space' || event.key === ' ') && !event.repeat) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        handleToggleTimeTravel();
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
    return () => { window.removeEventListener('keydown', onKeyDown); };
  }, [timeTravelControls, handleToggleTimeTravel, onTickChange, replMode]);

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
    setPerformanceMode((v) => {
      if (!v) setReplMode(false);
      return !v;
    });
  }, []);

  const handleToggleReplMode = useCallback(() => {
    setReplMode((v) => {
      if (!v) setPerformanceMode(false);
      return !v;
    });
  }, []);

  const handleToggleTimeFormat = useCallback(() => {
    const current = timeFormatOverride ?? (timeTravelControls.nowIsTimestamp ?? false);
    setTimeFormatOverride(!current);
  }, [timeFormatOverride, timeTravelControls.nowIsTimestamp]);

  const handleToggleActivityWindow = useCallback(() => {
    setActivityWindowVisible((visible) => !visible);
  }, []);

  const handleOpenStudioDrawer = useCallback(() => {
    setStudioDrawerOpen((v) => !v);
    setStudioSettingsOpen(false);
  }, []);

  const handleCloseStudioDrawer = useCallback(() => {
    setStudioDrawerOpen(false);
  }, []);

  const handleOpenStudioSettings = useCallback(() => {
    setStudioSettingsOpen((v) => !v);
    setStudioDrawerOpen(false);
  }, []);

  const handleCloseStudioSettings = useCallback(() => {
    setStudioSettingsOpen(false);
  }, []);

  const handleToggleActivityWindowCollapsed = useCallback(() => {
    setActivityWindowCollapsed((collapsed) => {
      const next = !collapsed;
      try { localStorage.setItem(ACTIVITY_COLLAPSED_STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleToggleActivityOptionsCollapsed = useCallback(() => {
    setActivityOptionsCollapsed((collapsed) => !collapsed);
  }, []);

  const handleSetRunningMode = useCallback(() => {
    setActivityModeState('running');
  }, []);

  const handleSetRunningOrSuccessMode = useCallback(() => {
    setActivityModeState('running_or_success');
  }, []);

  const handleSetAllMode = useCallback(() => {
    setActivityModeState('all');
  }, []);

  const handleSetActivityLabelMode = useCallback(() => {
    setActivityLabelMode('activity');
  }, []);

  const handleSetNodeLabelMode = useCallback(() => {
    setActivityLabelMode('node');
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

      setActivityWindowPosition({ x: ACTIVITY_WINDOW_PADDING, y: ACTIVITY_WINDOW_PADDING });
    });

    return () => { cancelAnimationFrame(frame); };
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
      if (event.pointerId !== drag?.pointerId) return;

      const nextX = drag.startX + (event.clientX - drag.startClientX);
      const nextY = drag.startY + (event.clientY - drag.startClientY);
      setActivityWindowPosition(clampActivityWindowPosition(nextX, nextY));
    };

    const onPointerEnd = (event: PointerEvent) => {
      const drag = activityDragRef.current;
      if (event.pointerId !== drag?.pointerId) return;
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
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [activityWindowPosition]);

  const handleActivityWindowControlPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const collapsedActivityBranch = activityBranches[activityBranches.length - 1];

  const collapsedActivityEntry = useMemo(() => {
    const branch = collapsedActivityBranch;
    if (!branch) return 'No activity';
    const label = getActivityBranchText(branch).trim();
    return label.length > 0 ? label : 'No activity';
  }, [collapsedActivityBranch, getActivityBranchText]);

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

    const syncStyles = () => { setShadowStyles(collectDebuggerStyles()); };
    syncStyles();

    const observer = new MutationObserver(syncStyles);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
    });

    return () => { observer.disconnect(); };
  }, [isolateStyles]);

  const isEmptyTree = emptyState !== undefined
    && (!tree.children || tree.children.length === 0);

  const studioToolbar = studioControls
    ? buildStudioToolbarFragments(studioControls, handleOpenStudioDrawer, handleOpenStudioSettings)
    : null;

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
              studioSection={studioToolbar?.leading}
              settingsButton={studioToolbar?.trailing}
              byteMetricsBadge={studioToolbar?.byteMetricsBadge}
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
              replPanelEnabled={replPanel !== undefined}
              replMode={replMode}
              onToggleReplMode={replPanel !== undefined ? handleToggleReplMode : undefined}
              activityWindowEnabled={activityWindowEnabled}
              activityWindowVisible={activityWindowVisible}
              onToggleActivityWindow={activityWindowEnabled ? handleToggleActivityWindow : undefined}
            />
          ) : null
        }
        canvas={
          <div className="bt-canvas-surface" ref={canvasSurfaceRef}>
            {isEmptyTree ? (
              <div className="bt-canvas-surface__empty-state">{emptyState}</div>
            ) : replMode && replPanel ? (
              <div className="bt-canvas-surface__repl">{replPanel}</div>
            ) : performanceMode ? (
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

            {studioControls && studioDrawerOpen && (
              <AttachDrawer controls={studioControls} onClose={handleCloseStudioDrawer} />
            )}

            {studioControls && studioSettingsOpen && (
              <SettingsPanel
                serverSettings={studioControls.serverSettings}
                uiSettings={studioControls.uiSettings}
                onServerSettingsChange={studioControls.onServerSettingsChange}
                onUiSettingsChange={studioControls.onUiSettingsChange}
                onClose={handleCloseStudioSettings}
              />
            )}

            {!performanceMode && !replMode && activityWindowEnabled && activityWindowVisible && (
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
                      onClick={handleToggleActivityOptionsCollapsed}
                      aria-label={activityOptionsCollapsed ? 'Show activity options menu' : 'Hide activity options menu'}
                      title={activityOptionsCollapsed ? 'Show activity options menu' : 'Hide activity options menu'}
                    >
                      {activityOptionsCollapsed ? '⚙' : '⋯'}
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
                {!activityWindowCollapsed && !activityOptionsCollapsed && (
                  <div className="bt-canvas-surface__activity-settings">
                    <div
                      className="bt-canvas-surface__activity-segmented"
                      role="group"
                      aria-label="Activity result filter mode"
                    >
                      <button
                        type="button"
                        className={`bt-canvas-surface__activity-segment ${activityModeState === 'running' ? 'bt-canvas-surface__activity-segment--active' : ''}`}
                        onPointerDown={handleActivityWindowControlPointerDown}
                        onClick={handleSetRunningMode}
                        title="Show only Running activity entries"
                        aria-label="Show only running activities"
                      >
                        R
                      </button>
                      <button
                        type="button"
                        className={`bt-canvas-surface__activity-segment ${activityModeState === 'running_or_success' ? 'bt-canvas-surface__activity-segment--active' : ''}`}
                        onPointerDown={handleActivityWindowControlPointerDown}
                        onClick={handleSetRunningOrSuccessMode}
                        title="Show Running and Succeeded activity entries"
                        aria-label="Show running and success activities"
                      >
                        R+S
                      </button>
                      <button
                        type="button"
                        className={`bt-canvas-surface__activity-segment ${activityModeState === 'all' ? 'bt-canvas-surface__activity-segment--active' : ''}`}
                        onPointerDown={handleActivityWindowControlPointerDown}
                        onClick={handleSetAllMode}
                        title="Show all activity entries"
                        aria-label="Show all activities"
                      >
                        All
                      </button>
                    </div>
                    <div
                      className="bt-canvas-surface__activity-segmented"
                      role="group"
                      aria-label="Activity text source"
                    >
                      <button
                        type="button"
                        className={`bt-canvas-surface__activity-segment ${activityLabelMode === 'activity' ? 'bt-canvas-surface__activity-segment--active' : ''}`}
                        onPointerDown={handleActivityWindowControlPointerDown}
                        onClick={handleSetActivityLabelMode}
                        title="Show activity labels"
                        aria-label="Show activity labels"
                      >
                        Activity
                      </button>
                      <button
                        type="button"
                        className={`bt-canvas-surface__activity-segment ${activityLabelMode === 'node' ? 'bt-canvas-surface__activity-segment--active' : ''}`}
                        onPointerDown={handleActivityWindowControlPointerDown}
                        onClick={handleSetNodeLabelMode}
                        title="Show node names"
                        aria-label="Show node names"
                      >
                        Node
                      </button>
                    </div>
                  </div>
                )}
                {!activityWindowCollapsed && (
                  <ActivityNowPanel
                    branches={activityBranches}
                    onSelectBranch={handleSelectActivityBranch}
                    selectedTailNodeId={selectedActivityTailNodeId}
                    getBranchText={getActivityBranchText}
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
              cpuTimeline={cpuTimeline}
              byteTimeline={timeTravelControls.mode === 'paused' ? (frozenByteTimeline ?? undefined) : studioControls?.byteMetrics?.samples}
              displayTimeAsTimestamp={displayTimeAsTimestamp}
              onTickChange={onTickChange}
              onSelectRange={studioControls ? handleSelectRange : undefined}
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
