import { memo } from 'react';
import type { NodeProfilingData } from '@behavior-tree-ist/core/inspector';
import { formatMs } from '../../utils/format';

interface NodeProfilingDisplayProps {
  profilingData: NodeProfilingData;
  percentilesApproximate?: boolean;
}

function NodeProfilingDisplayInner({
  profilingData,
  percentilesApproximate = false,
}: NodeProfilingDisplayProps) {
  if (profilingData.tickCount === 0) return null;

  const avgCpu = profilingData.totalCpuTime / profilingData.tickCount;
  const avgSelfCpu = profilingData.totalSelfCpuTime / profilingData.tickCount;
  const hasRunningTime = profilingData.runningTimeCount > 0;
  const avgRunning = hasRunningTime
    ? profilingData.totalRunningTime / profilingData.runningTimeCount
    : 0;

  return (
    <div className="bt-profiling">
      <div className="bt-profiling__title-row">
        <div className="bt-profiling__title">Profiling</div>
        {percentilesApproximate && (
          <span
            className="bt-profiling__approx-badge"
            title="Live percentiles are sampled for responsiveness. Pause or time travel for exact window percentiles."
          >
            Approx Percentiles
          </span>
        )}
      </div>
      <div className="bt-profiling__grid">
        <div className="bt-profiling__section">
          <div className="bt-profiling__section-label">CPU Time</div>
          <div className="bt-profiling__metrics">
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">avg</span>
              <span className="bt-profiling__metric-value">{formatMs(avgCpu)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">min</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.minCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">max</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.maxCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">total</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.totalCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p50</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.cpuP50)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p95</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.cpuP95)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p99</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.cpuP99)}</span>
            </span>
          </div>
        </div>

        <div className="bt-profiling__section">
          <div className="bt-profiling__section-label">Self CPU Time</div>
          <div className="bt-profiling__metrics">
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">avg</span>
              <span className="bt-profiling__metric-value">{formatMs(avgSelfCpu)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">min</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.minSelfCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">max</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.maxSelfCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">total</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.totalSelfCpuTime)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p50</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.selfCpuP50)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p95</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.selfCpuP95)}</span>
            </span>
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">p99</span>
              <span className="bt-profiling__metric-value">{formatMs(profilingData.selfCpuP99)}</span>
            </span>
          </div>
        </div>

        {hasRunningTime && (
          <div className="bt-profiling__section">
            <div className="bt-profiling__section-label">Running Time</div>
            <div className="bt-profiling__metrics">
              <span className="bt-profiling__metric">
                <span className="bt-profiling__metric-label">avg</span>
                <span className="bt-profiling__metric-value">{formatMs(avgRunning)}</span>
              </span>
              <span className="bt-profiling__metric">
                <span className="bt-profiling__metric-label">min</span>
                <span className="bt-profiling__metric-value">{formatMs(profilingData.minRunningTime)}</span>
              </span>
              <span className="bt-profiling__metric">
                <span className="bt-profiling__metric-label">max</span>
                <span className="bt-profiling__metric-value">{formatMs(profilingData.maxRunningTime)}</span>
              </span>
              <span className="bt-profiling__metric">
                <span className="bt-profiling__metric-label">total</span>
                <span className="bt-profiling__metric-value">{formatMs(profilingData.totalRunningTime)}</span>
              </span>
            </div>
          </div>
        )}

        <div className="bt-profiling__section">
          <div className="bt-profiling__section-label">Ticks</div>
          <div className="bt-profiling__metrics">
            <span className="bt-profiling__metric">
              <span className="bt-profiling__metric-label">count</span>
              <span className="bt-profiling__metric-value">{profilingData.tickCount}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const NodeProfilingDisplay = memo(NodeProfilingDisplayInner);
