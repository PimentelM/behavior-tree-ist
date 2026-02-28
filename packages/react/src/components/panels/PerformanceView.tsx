import { memo, useCallback, useState } from 'react';
import type { FlameGraphFrame, NodeProfilingData, TreeIndex, TreeStats } from '@behavior-tree-ist/core/inspector';
import { FlameGraph, countFrames } from './FlameGraph';
import { HotNodesTable } from './HotNodesTable';
import { formatMs } from '../../utils/format';

interface PerformanceViewProps {
  frames: FlameGraphFrame[];
  hotNodes: NodeProfilingData[];
  stats: TreeStats;
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
  treeIndex: TreeIndex | null;
  viewedTickId: number | null;
}

function PerformanceViewInner({
  frames,
  hotNodes,
  stats,
  onSelectNode,
  selectedNodeId,
  treeIndex,
  viewedTickId,
}: PerformanceViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const tickTotal = frames.reduce((sum, frame) => sum + frame.inclusiveTime, 0);
  const nodeCount = countFrames(frames);
  const clearHoveredNode = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  return (
    <div className="bt-perf-view">
      <div className="bt-perf-view__flamegraph">
        <div className="bt-perf-view__panel-header">
          <span className="bt-perf-view__scope-badge bt-perf-view__scope-badge--tick">Tick</span>
          <span className="bt-perf-view__panel-title">Flamegraph</span>
          <span className="bt-perf-view__panel-meta-item">#{viewedTickId ?? '-'}</span>
          {tickTotal > 0 && (
            <span className="bt-perf-view__panel-meta-item">CPU: {formatMs(tickTotal)}</span>
          )}
          {nodeCount > 0 && (
            <span className="bt-perf-view__panel-meta-item">Nodes: {nodeCount}</span>
          )}
        </div>
        <FlameGraph
          frames={frames}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onHoverNode={setHoveredNodeId}
          onClearHover={clearHoveredNode}
        />
      </div>
      <div className="bt-perf-view__hot-nodes">
        <HotNodesTable
          hotNodes={hotNodes}
          rootTotalCpuTime={stats.totalRootCpuTime}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
          treeIndex={treeIndex ?? null}
          windowTickCount={stats.storedTickCount}
          windowSpan={stats.profilingWindowSpan}
          hoveredNodeId={hoveredNodeId}
          onHoverNode={setHoveredNodeId}
          onClearHover={clearHoveredNode}
        />
      </div>
    </div>
  );
}

export const PerformanceView = memo(PerformanceViewInner);
