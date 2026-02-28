import { memo, useState, useCallback, useMemo } from 'react';
import type { NodeProfilingData, TreeIndex } from '@behavior-tree-ist/core/inspector';
import { formatMs } from '../../utils/format';

const DEFAULT_VISIBLE = 20;

type SortKey =
  | 'totalCpuTime'
  | 'totalSelfCpuTime'
  | 'avgCpu'
  | 'avgSelf'
  | 'cpuP95'
  | 'selfCpuP95'
  | 'tickCount'
  | 'totalPct'
  | 'totalSelfPct';

interface HotNodesTableProps {
  hotNodes: NodeProfilingData[];
  rootTotalCpuTime: number;
  windowTickCount: number;
  windowSpan: number;
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
  treeIndex: TreeIndex | null;
}

function HotNodesTableInner({
  hotNodes,
  rootTotalCpuTime,
  windowTickCount,
  windowSpan,
  onSelectNode,
  selectedNodeId,
  treeIndex,
}: HotNodesTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('totalCpuTime');

  const toggleShowAll = useCallback(() => {
    setShowAll((v) => !v);
  }, []);

  const setSort = useCallback((nextSortKey: SortKey) => {
    setSortKey(nextSortKey);
  }, []);

  if (hotNodes.length === 0) return null;

  const rows = useMemo(() => {
    return hotNodes.map((node) => {
      const indexed = treeIndex?.getById(node.nodeId);
      const name = indexed?.name || indexed?.defaultName || `Node ${node.nodeId}`;
      const avgCpu = node.tickCount > 0 ? node.totalCpuTime / node.tickCount : 0;
      const avgSelf = node.tickCount > 0 ? node.totalSelfCpuTime / node.tickCount : 0;
      const totalPct = rootTotalCpuTime > 0 ? (node.totalCpuTime / rootTotalCpuTime) * 100 : 0;
      const totalSelfPct = rootTotalCpuTime > 0 ? (node.totalSelfCpuTime / rootTotalCpuTime) * 100 : 0;
      return {
        name,
        node,
        avgCpu,
        avgSelf,
        totalPct,
        totalSelfPct,
      };
    });
  }, [hotNodes, rootTotalCpuTime, treeIndex]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'totalCpuTime':
          return b.node.totalCpuTime - a.node.totalCpuTime;
        case 'totalSelfCpuTime':
          return b.node.totalSelfCpuTime - a.node.totalSelfCpuTime;
        case 'avgCpu':
          return b.avgCpu - a.avgCpu;
        case 'avgSelf':
          return b.avgSelf - a.avgSelf;
        case 'cpuP95':
          return b.node.cpuP95 - a.node.cpuP95;
        case 'selfCpuP95':
          return b.node.selfCpuP95 - a.node.selfCpuP95;
        case 'tickCount':
          return b.node.tickCount - a.node.tickCount;
        case 'totalPct':
          return b.totalPct - a.totalPct;
        case 'totalSelfPct':
          return b.totalSelfPct - a.totalSelfPct;
        default:
          return b.node.totalCpuTime - a.node.totalCpuTime;
      }
    });
    return sorted;
  }, [rows, sortKey]);

  const visible = showAll ? sortedRows : sortedRows.slice(0, DEFAULT_VISIBLE);
  const hasMore = sortedRows.length > DEFAULT_VISIBLE;

  const sortArrow = ' \u2193';

  return (
    <div className="bt-hot-nodes">
      <div className="bt-hot-nodes__header-bar">
        <div className="bt-hot-nodes__title">Hot Nodes (Window)</div>
        <div className="bt-hot-nodes__meta">
          <span className="bt-hot-nodes__meta-item">
            Total Ticks: {windowTickCount}
          </span>
          <span className="bt-hot-nodes__meta-item">
            Total Time: {formatMs(rootTotalCpuTime)} / {formatMs(windowSpan)}
          </span>
        </div>
      </div>
      <table className="bt-hot-nodes__table">
        <thead>
          <tr className="bt-hot-nodes__header">
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--name">Name</th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'totalCpuTime' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('totalCpuTime')}
                type="button"
              >
                Total CPU{sortKey === 'totalCpuTime' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'totalSelfCpuTime' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('totalSelfCpuTime')}
                type="button"
              >
                Total Self{sortKey === 'totalSelfCpuTime' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'totalPct' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('totalPct')}
                type="button"
              >
                Total %{sortKey === 'totalPct' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'totalSelfPct' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('totalSelfPct')}
                type="button"
              >
                Total Self %{sortKey === 'totalSelfPct' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'avgCpu' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('avgCpu')}
                type="button"
              >
                Avg CPU{sortKey === 'avgCpu' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'avgSelf' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('avgSelf')}
                type="button"
              >
                Avg Self{sortKey === 'avgSelf' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'cpuP95' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('cpuP95')}
                type="button"
              >
                P95 CPU{sortKey === 'cpuP95' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'selfCpuP95' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('selfCpuP95')}
                type="button"
              >
                P95 Self{sortKey === 'selfCpuP95' ? sortArrow : ''}
              </button>
            </th>
            <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
              <button
                className={`bt-hot-nodes__sort ${sortKey === 'tickCount' ? 'bt-hot-nodes__sort--active' : ''}`}
                onClick={() => setSort('tickCount')}
                type="button"
              >
                Ticks{sortKey === 'tickCount' ? sortArrow : ''}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const { node, name, avgCpu, avgSelf, totalPct, totalSelfPct } = row;
            const isSelected = node.nodeId === selectedNodeId;

            return (
              <tr
                key={node.nodeId}
                className={`bt-hot-nodes__row ${isSelected ? 'bt-hot-nodes__row--selected' : ''}`}
                onClick={() => onSelectNode(node.nodeId)}
              >
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--name">{name}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.totalCpuTime)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.totalSelfCpuTime)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{totalPct.toFixed(1)}%</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{totalSelfPct.toFixed(1)}%</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(avgCpu)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(avgSelf)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.cpuP95)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.selfCpuP95)}</td>
                <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{node.tickCount}</td>
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
