import { memo } from 'react';
import type { NodeProfilingData } from '@behavior-tree-ist/core/inspector';

interface NodeProfilingDisplayProps {
  profilingData: NodeProfilingData;
}

function formatMs(value: number): string {
  if (value < 0.01) return '<0.01ms';
  if (value < 1) return `${value.toFixed(2)}ms`;
  if (value < 100) return `${value.toFixed(1)}ms`;
  if (value < 1000) return `${Math.round(value)}ms`;
  return `${(value / 1000).toFixed(2)}s`;
}

function NodeProfilingDisplayInner({ profilingData }: NodeProfilingDisplayProps) {
  if (profilingData.tickCount === 0) return null;

  const avgCpu = profilingData.totalCpuTime / profilingData.tickCount;
  const hasRunningTime = profilingData.runningTimeCount > 0;
  const avgRunning = hasRunningTime
    ? profilingData.totalRunningTime / profilingData.runningTimeCount
    : 0;

  return (
    <div className="bt-profiling">
      <div className="bt-profiling__title">Profiling</div>
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
