import { memo, useState, useCallback } from 'react';
import type { NodeProfilingData, TreeIndex } from '@behavior-tree-ist/core/inspector';
import { formatMs } from '../../utils/format';

const DEFAULT_VISIBLE = 20;

interface HotNodesTableProps {
  hotNodes: NodeProfilingData[];
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
  treeIndex: TreeIndex | null;
}

function HotNodesTableInner({
  hotNodes,
  onSelectNode,
  selectedNodeId,
  treeIndex,
}: HotNodesTableProps) {
  const [showAll, setShowAll] = useState(false);

  const toggleShowAll = useCallback(() => {
    setShowAll((v) => !v);
  }, []);

  if (hotNodes.length === 0) return null;

  const grandTotal = hotNodes.reduce((sum, n) => sum + n.totalCpuTime, 0);
  const visible = showAll ? hotNodes : hotNodes.slice(0, DEFAULT_VISIBLE);
  const hasMore = hotNodes.length > DEFAULT_VISIBLE;

  return (
    <div className="bt-hot-nodes">
      <div className="bt-hot-nodes__title">Hot Nodes</div>
      <table className="bt-hot-nodes__table">
        <thead>
          <tr className="bt-hot-nodes__header">
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--name">Name</th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">Total CPU</th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">Avg CPU</th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">Ticks</th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">%</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((node) => {
            const indexed = treeIndex?.getById(node.nodeId);
            const name = indexed?.name || indexed?.defaultName || `Node ${node.nodeId}`;
            const avg = node.tickCount > 0 ? node.totalCpuTime / node.tickCount : 0;
            const pct = grandTotal > 0 ? (node.totalCpuTime / grandTotal) * 100 : 0;
            const isSelected = node.nodeId === selectedNodeId;

            return (
              <tr
                key={node.nodeId}
                className={`bt-hot-nodes__row ${isSelected ? 'bt-hot-nodes__row--selected' : ''}`}
                onClick={() => onSelectNode(node.nodeId)}
              >
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--name">{name}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.totalCpuTime)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(avg)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{node.tickCount}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{pct.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasMore && (
        <button
          className="bt-hot-nodes__toggle"
          onClick={toggleShowAll}
          type="button"
        >
          {showAll ? 'Show less' : `Show all (${hotNodes.length})`}
        </button>
      )}
    </div>
  );
}

export const HotNodesTable = memo(HotNodesTableInner);
