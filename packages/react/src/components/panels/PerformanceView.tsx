import { memo } from 'react';
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
  const tickTotal = frames.reduce((sum, frame) => sum + frame.inclusiveTime, 0);
  const nodeCount = countFrames(frames);

  return (
    <div className="bt-perf-view">
      <div className="bt-perf-view__summary">
        <div className="bt-perf-view__summary-group">
          <span className="bt-perf-view__summary-label">Tick</span>
          <span className="bt-perf-view__summary-item">#{viewedTickId ?? '-'}</span>
          {tickTotal > 0 && (
            <span className="bt-perf-view__summary-item">CPU: {formatMs(tickTotal)}</span>
          )}
          {nodeCount > 0 && (
            <span className="bt-perf-view__summary-item">
              Nodes: {nodeCount}
            </span>
          )}
        </div>
        <div className="bt-perf-view__summary-group">
          <span className="bt-perf-view__summary-label">Window</span>
          <span className="bt-perf-view__summary-item">Ticks: {stats.storedTickCount}</span>
          <span className="bt-perf-view__summary-item">Total CPU: {formatMs(stats.totalRootCpuTime)}</span>
          {stats.storedTickCount > 0 && (
            <span className="bt-perf-view__summary-item">Span: {formatMs(stats.profilingWindowSpan)}</span>
          )}
        </div>
      </div>
      <div className="bt-perf-view__flamegraph">
        <FlameGraph
          frames={frames}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
        />
      </div>
      <div className="bt-perf-view__hot-nodes">
        <HotNodesTable
          hotNodes={hotNodes}
          rootTotalCpuTime={stats.totalRootCpuTime}
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
          treeIndex={treeIndex ?? null}
        />
      </div>
    </div>
  );
}

export const PerformanceView = memo(PerformanceViewInner);
