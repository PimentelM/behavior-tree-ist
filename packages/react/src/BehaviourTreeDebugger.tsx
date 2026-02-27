import { useState, useCallback, useEffect, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
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
      <ReactFlowProvider>
        <DebuggerLayout
          showSidebar={showSidebar}
          showTimeline={showTimeline}
          canvas={
            <TreeCanvas
              nodes={nodes}
              edges={edges}
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
    </div>
  );
}
