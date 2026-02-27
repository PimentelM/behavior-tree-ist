import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { createPortal } from 'react-dom';
import type { RefChangeEvent } from '@behavior-tree-ist/core';
import type { BehaviourTreeDebuggerProps } from './types';
import { useInspector } from './hooks/useInspector';
import { useTreeLayout } from './hooks/useTreeLayout';
import { useSnapshotOverlay } from './hooks/useSnapshotOverlay';
import { useTimeTravelControls } from './hooks/useTimeTravelControls';
import { useNodeDetails } from './hooks/useNodeDetails';
import { DebuggerLayout } from './components/DebuggerLayout';
import { TreeCanvas } from './components/TreeCanvas';
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
  layoutDirection = 'TB',
  width = '100%',
  height = '100%',
  isolateStyles = true,
  onNodeSelect,
  onTickChange,
  className,
}: BehaviourTreeDebuggerProps) {
  const theme = useMemo(() => buildTheme(themeOverrides), [themeOverrides]);
  const cssVars = useMemo(() => themeToCSSVars(theme), [theme]);

  const { inspector, tickGeneration } = useInspector(tree, ticks, inspectorOptions);

  // Expose inspector via ref
  useEffect(() => {
    if (inspectorRef) {
      inspectorRef.current = inspector;
    }
  }, [inspector, inspectorRef]);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const timeTravelControls = useTimeTravelControls(inspector, tickGeneration);
  const { viewedTickId } = timeTravelControls;

  // Layout: only recomputes when tree changes
  const { nodes: baseNodes, edges: baseEdges } = useTreeLayout(
    inspector.tree,
    layoutDirection,
  );

  const layoutVersion = useMemo(
    () => `${layoutDirection}:${baseNodes.length}:${baseEdges.length}`,
    [layoutDirection, baseNodes.length, baseEdges.length],
  );

  // Overlay snapshot data onto nodes
  const { nodes, edges } = useSnapshotOverlay(
    baseNodes,
    baseEdges,
    inspector,
    viewedTickId,
    selectedNodeId,
    tickGeneration,
  );

  // Node details for sidebar
  const nodeDetails = useNodeDetails(inspector, selectedNodeId, viewedTickId, tickGeneration);

  // Collect ref events for the ref traces panel
  const refEvents = useMemo(() => {
    const allTicks = inspector.getStoredTickIds();
    const events: RefChangeEvent[] = [];
    for (const tickId of allTicks) {
      const range = inspector.getTickRange(tickId, tickId);
      for (const record of range) {
        events.push(...record.refEvents);
      }
    }
    return events;
  }, [inspector, tickGeneration]);

  const handleNodeClick = useCallback(
    (nodeId: number) => {
      setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
      onNodeSelect?.(nodeId);
    },
    [onNodeSelect],
  );

  const handleGoToTick = useCallback(
    (tickId: number) => {
      timeTravelControls.goToTick(tickId);
      onTickChange?.(tickId);
    },
    [timeTravelControls, onTickChange],
  );

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
        canvas={
          <TreeCanvas
            nodes={nodes}
            edges={edges}
            layoutVersion={layoutVersion}
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
        className={`bt-debugger ${className ?? ''}`}
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
            <div className="bt-debugger" style={isolatedContainerStyle}>
              {content}
            </div>
          </>,
          shadowRoot,
        )
        : null}
    </div>
  );
}
