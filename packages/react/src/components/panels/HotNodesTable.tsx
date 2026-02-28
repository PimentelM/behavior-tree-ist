import { memo, useState, useCallback, useMemo, type UIEvent } from 'react';
import type { NodeProfilingData, TreeIndex } from '@behavior-tree-ist/core/inspector';
import { formatMs } from '../../utils/format';

const DEFAULT_VISIBLE = 20;
const LOAD_CHUNK_SIZE = 20;
const LOAD_THRESHOLD_PX = 72;
const PERCENTILE_OPTIONS = ['p50', 'p95', 'p99'] as const;
type PercentileKey = (typeof PERCENTILE_OPTIONS)[number];

type SortKey =
  | 'totalCpuTime'
  | 'totalSelfCpuTime'
  | 'avgCpu'
  | 'avgSelf'
  | 'inclusivePercentile'
  | 'selfPercentile'
  | 'tickCount'
  | 'totalPct'
  | 'totalSelfPct';

const ADVANCED_SORT_KEYS: ReadonlySet<SortKey> = new Set<SortKey>([
  'totalCpuTime',
  'totalPct',
  'avgCpu',
  'inclusivePercentile',
]);

function getSelfPercentile(node: NodeProfilingData, percentile: PercentileKey): number {
  switch (percentile) {
    case 'p50':
      return node.selfCpuP50;
    case 'p95':
      return node.selfCpuP95;
    case 'p99':
      return node.selfCpuP99;
    default:
      return node.selfCpuP95;
  }
}

function getInclusivePercentile(node: NodeProfilingData, percentile: PercentileKey): number {
  switch (percentile) {
    case 'p50':
      return node.cpuP50;
    case 'p95':
      return node.cpuP95;
    case 'p99':
      return node.cpuP99;
    default:
      return node.cpuP95;
  }
}

function getSortLabel(sortKey: SortKey, percentile: PercentileKey): string {
  const percentileLabel = percentile.toUpperCase();
  switch (sortKey) {
    case 'totalCpuTime':
      return 'Total Inclusive';
    case 'totalSelfCpuTime':
      return 'Total Self';
    case 'avgCpu':
      return 'Avg Inclusive';
    case 'avgSelf':
      return 'Avg Self';
    case 'inclusivePercentile':
      return `${percentileLabel} Inclusive`;
    case 'selfPercentile':
      return `${percentileLabel} Self`;
    case 'tickCount':
      return 'Ticks';
    case 'totalPct':
      return 'Total Inclusive %';
    case 'totalSelfPct':
      return 'Total Self %';
    default:
      return 'Total Self';
  }
}

interface HotNodesTableProps {
  hotNodes: NodeProfilingData[];
  rootTotalCpuTime: number;
  percentilesApproximate?: boolean;
  windowTickCount: number;
  windowSpan: number;
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
  treeIndex: TreeIndex | null;
  hoveredNodeId: number | null;
  onHoverNode: (nodeId: number) => void;
  onClearHover: () => void;
}

function HotNodesTableInner({
  hotNodes,
  rootTotalCpuTime,
  percentilesApproximate = false,
  windowTickCount,
  windowSpan,
  onSelectNode,
  selectedNodeId,
  treeIndex,
  hoveredNodeId,
  onHoverNode,
  onClearHover,
}: HotNodesTableProps) {
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('totalSelfCpuTime');
  const [selectedPercentile, setSelectedPercentile] = useState<PercentileKey>('p95');

  const setSort = useCallback((nextSortKey: SortKey) => {
    setSortKey(nextSortKey);
    setVisibleCount(DEFAULT_VISIBLE);
  }, []);
  const toggleAdvanced = useCallback(() => {
    setShowAdvanced((current) => {
      const next = !current;
      if (!next && ADVANCED_SORT_KEYS.has(sortKey)) {
        setSortKey('totalSelfCpuTime');
      }
      return next;
    });
  }, [sortKey]);

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
        case 'inclusivePercentile':
          return getInclusivePercentile(b.node, selectedPercentile) - getInclusivePercentile(a.node, selectedPercentile);
        case 'selfPercentile':
          return getSelfPercentile(b.node, selectedPercentile) - getSelfPercentile(a.node, selectedPercentile);
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
  }, [rows, selectedPercentile, sortKey]);

  const hasMore = visibleCount < sortedRows.length;
  const visible = sortedRows.slice(0, visibleCount);

  const handleTableScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const element = event.currentTarget;
    const scrollBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (scrollBottom <= LOAD_THRESHOLD_PX) {
      setVisibleCount((current) => Math.min(current + LOAD_CHUNK_SIZE, sortedRows.length));
    }
  }, [hasMore, sortedRows.length]);

  const sortArrow = ' \u2193';
  const sortedLabel = getSortLabel(sortKey, selectedPercentile);
  const percentileLabel = selectedPercentile.toUpperCase();

  const renderSortHeader = (key: SortKey, label: string) => (
    <th className="bt-hot-nodes__cell bt-hot-nodes__cell--num">
      <button
        className={`bt-hot-nodes__sort ${sortKey === key ? 'bt-hot-nodes__sort--active' : ''}`}
        onClick={() => setSort(key)}
        type="button"
      >
        {label}{sortKey === key ? sortArrow : ''}
      </button>
    </th>
  );

  return (
    <div className="bt-hot-nodes">
      <div className="bt-hot-nodes__header-bar">
        <div className="bt-hot-nodes__header-left">
          <span className="bt-perf-view__scope-badge bt-perf-view__scope-badge--window">Window</span>
          <div className="bt-hot-nodes__title">Hot Nodes</div>
          <div className="bt-hot-nodes__meta">
            <span className="bt-hot-nodes__meta-item">Total Ticks: {windowTickCount}</span>
            <span className="bt-hot-nodes__meta-item">Total Time: {formatMs(rootTotalCpuTime)} / {formatMs(windowSpan)}</span>
            <button
              className="bt-hot-nodes__hint"
              title="Total Time = accumulated root CPU in the window / wall-clock span of the same window."
              type="button"
            >
              ?
            </button>
          </div>
        </div>
        <div className="bt-hot-nodes__header-actions">
          <span className="bt-hot-nodes__sorted-by">Sorted by: {sortedLabel}</span>
          <div className="bt-hot-nodes__percentile-toggle" aria-label="Percentile selector">
            {PERCENTILE_OPTIONS.map((option) => (
              <button
                key={option}
                className={`bt-hot-nodes__percentile-btn ${selectedPercentile === option ? 'bt-hot-nodes__percentile-btn--active' : ''}`}
                onClick={() => setSelectedPercentile(option)}
                type="button"
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
          {percentilesApproximate && (
            <span
              className="bt-hot-nodes__approx-badge"
              title="Live percentiles are sampled for responsiveness. Pause or time travel for exact window percentiles."
            >
              Approx
            </span>
          )}
          <button className="bt-hot-nodes__toggle bt-hot-nodes__toggle--advanced" onClick={toggleAdvanced} type="button">
            {showAdvanced ? 'Hide Inclusive metrics' : 'Show Inclusive metrics'}
          </button>
        </div>
      </div>
      {hotNodes.length === 0 ? (
        <div className="bt-hot-nodes__empty">No profiling data in the current window.</div>
      ) : (
        <>
          <div className="bt-hot-nodes__table-wrap" onMouseLeave={onClearHover} onScroll={handleTableScroll}>
            <table className="bt-hot-nodes__table">
              <thead>
                <tr className="bt-hot-nodes__header">
                  <th className="bt-hot-nodes__cell bt-hot-nodes__cell--name">Name</th>
                  {renderSortHeader('totalSelfCpuTime', 'Total Self')}
                  {renderSortHeader('totalSelfPct', 'Total Self %')}
                  {renderSortHeader('avgSelf', 'Avg Self')}
                  {renderSortHeader('selfPercentile', `${percentileLabel} Self`)}
                  {renderSortHeader('tickCount', 'Ticks')}
                  {showAdvanced && renderSortHeader('totalCpuTime', 'Total Inclusive')}
                  {showAdvanced && renderSortHeader('totalPct', 'Total Inclusive %')}
                  {showAdvanced && renderSortHeader('avgCpu', 'Avg Inclusive')}
                  {showAdvanced && renderSortHeader('inclusivePercentile', `${percentileLabel} Inclusive`)}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const { node, name, avgCpu, avgSelf, totalPct, totalSelfPct } = row;
                  const isSelected = node.nodeId === selectedNodeId;
                  const isHovered = node.nodeId === hoveredNodeId;
                  const totalPctWidth = Math.max(0, Math.min(100, totalPct));
                  const totalSelfPctWidth = Math.max(0, Math.min(100, totalSelfPct));

                  return (
                    <tr
                      key={node.nodeId}
                      className={`bt-hot-nodes__row ${isSelected ? 'bt-hot-nodes__row--selected' : ''} ${isHovered ? 'bt-hot-nodes__row--hovered' : ''}`}
                      onClick={() => onSelectNode(node.nodeId)}
                      onMouseEnter={() => onHoverNode(node.nodeId)}
                    >
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--name" title={name}>{name}</td>
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.totalSelfCpuTime)}</td>
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num bt-hot-nodes__cell--pct">
                        <div className="bt-hot-nodes__pct-cell">
                          <span className="bt-hot-nodes__pct-fill bt-hot-nodes__pct-fill--self" style={{ width: `${totalSelfPctWidth}%` }} />
                          <span className="bt-hot-nodes__pct-value">{totalSelfPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(avgSelf)}</td>
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(getSelfPercentile(node, selectedPercentile))}</td>
                      <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{node.tickCount}</td>
                      {showAdvanced && (
                        <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(node.totalCpuTime)}</td>
                      )}
                      {showAdvanced && (
                        <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num bt-hot-nodes__cell--pct">
                          <div className="bt-hot-nodes__pct-cell">
                            <span className="bt-hot-nodes__pct-fill" style={{ width: `${totalPctWidth}%` }} />
                            <span className="bt-hot-nodes__pct-value">{totalPct.toFixed(1)}%</span>
                          </div>
                        </td>
                      )}
                      {showAdvanced && (
                        <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(avgCpu)}</td>
                      )}
                      {showAdvanced && (
                        <td className="bt-hot-nodes__cell bt-hot-nodes__cell--num">{formatMs(getInclusivePercentile(node, selectedPercentile))}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export const HotNodesTable = memo(HotNodesTableInner);
