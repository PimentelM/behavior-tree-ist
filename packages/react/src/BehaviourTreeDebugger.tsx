import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { DebuggerLayout } from './components/DebuggerLayout';
import { TreeCanvas } from './components/TreeCanvas';
import { ToolbarPanel } from './components/panels/ToolbarPanel';
import { TimelinePanel } from './components/panels/TimelinePanel';
import { NodeDetailPanel } from './components/panels/NodeDetailPanel';
import { buildTheme, themeToCSSVars } from './styles/theme';
import './styles/debugger.css';

const SHADOW_BASE_CSS = [
  ':host{display:block;box-sizing:border-box;}',
  ':host *,:host *::before,:host *::after{box-sizing:border-box;}',
].join('');

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
  panels = { nodeDetails: true, timeline: true, refTraces: true },
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
  const [centerTreeSignal, setCenterTreeSignal] = useState(0);
  const [focusNodeId, setFocusNodeId] = useState<number | null>(null);
  const [focusNodeSignal, setFocusNodeSignal] = useState(0);
  const [pausedInspector, setPausedInspector] = useState<TreeInspector | null>(null);

  useEffect(() => {
    setPausedInspector(null);
  }, [tree]);

  const timeTravelControls = useTimeTravelControls(pausedInspector ?? inspector, tickGeneration);
  const { viewedTickId } = timeTravelControls;

  useEffect(() => {
    if (timeTravelControls.mode === 'live') {
      setPausedInspector(null);
      return;
    }

    if (pausedInspector) return;

    const frozen = new TreeInspector(inspectorOptions);
    frozen.indexTree(tree);
    const ids = inspector.getStoredTickIds();
    if (ids.length > 0) {
      const from = ids[0];
      const to = ids[ids.length - 1];
      const range = inspector.getTickRange(from, to);
      for (const record of range) {
        frozen.ingestTick(record);
      }
    }
    setPausedInspector(frozen);
  }, [timeTravelControls.mode, pausedInspector, inspector, inspectorOptions, tree]);

  const activeInspector = pausedInspector ?? inspector;

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
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  const handleFocusActorNode = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    setFocusNodeId(nodeId);
    setFocusNodeSignal((value) => value + 1);
    onNodeSelect?.(nodeId);
  }, [onNodeSelect]);

  // Overlay snapshot data onto nodes
  const { nodes, edges } = useSnapshotOverlay(
    baseNodes,
    baseEdges,
    activeInspector,
    viewedTickId,
    selectedNodeId,
    refEventsByNode,
    handleSelectNode,
    tickGeneration,
  );

  // Node details for sidebar
  const nodeDetails = useNodeDetails(activeInspector, selectedNodeId, viewedTickId, tickGeneration);

  // Collect ref events for the ref traces panel
  const refEvents = useMemo(() => {
    if (viewedTickId === null) return [];
    const events: RefChangeEvent[] = [];
    const range = activeInspector.getTickRange(viewedTickId, viewedTickId);
    for (const record of range) {
      for (const event of record.refEvents) {
        events.push(event);
      }
    }
    return events;
  }, [activeInspector, viewedTickId, tickGeneration]);

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      handleSelectNode(nodeId);
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

  const showSidebar = panels.nodeDetails !== false || panels.refTraces !== false;
  const showTimeline = panels.timeline !== false;
  const showRefTraces = panels.refTraces !== false;
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
              onToggleTimeTravel={handleToggleTimeTravel}
            />
          ) : null
        }
        canvas={
          <TreeCanvas
            nodes={nodes}
            edges={edges}
            layoutVersion={layoutVersion}
            centerTreeSignal={centerTreeSignal}
            focusNodeId={focusNodeId}
            focusNodeSignal={focusNodeSignal}
            onNodeClick={handleNodeClick}
          />
        }
        sidebar={
          showSidebar ? (
            <NodeDetailPanel
              details={nodeDetails}
              refEvents={refEvents}
              viewedTickId={viewedTickId}
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
