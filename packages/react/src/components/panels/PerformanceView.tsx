import { memo } from 'react';
import type { FlameGraphFrame, NodeProfilingData, TreeIndex } from '@behavior-tree-ist/core/inspector';
import { FlameGraph, countFrames } from './FlameGraph';
import { HotNodesTable } from './HotNodesTable';
import { formatMs } from '../../utils/format';

interface PerformanceViewProps {
  frames: FlameGraphFrame[];
  hotNodes: NodeProfilingData[];
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
  treeIndex: TreeIndex | null;
  viewedTickId: number | null;
}

function PerformanceViewInner({
  frames,
  hotNodes,
  onSelectNode,
  selectedNodeId,
  treeIndex,
  viewedTickId,
}: PerformanceViewProps) {
  const tickTotal = frames.length > 0 ? frames[0]!.inclusiveTime : 0;
  const nodeCount = countFrames(frames);

  return (
    <div className="bt-perf-view">
      <div className="bt-perf-view__summary">
        <span className="bt-perf-view__summary-item">
          Tick #{viewedTickId ?? '-'}
        </span>
        {tickTotal > 0 && (
          <span className="bt-perf-view__summary-item">
            Total: {formatMs(tickTotal)}
          </span>
        )}
        {nodeCount > 0 && (
          <span className="bt-perf-view__summary-item">
            {nodeCount} node{nodeCount !== 1 ? 's' : ''} profiled
          </span>
        )}
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
          onSelectNode={onSelectNode}
          selectedNodeId={selectedNodeId}
          treeIndex={treeIndex ?? null}
        />
      </div>
    </div>
  );
}

export const PerformanceView = memo(PerformanceViewInner);
