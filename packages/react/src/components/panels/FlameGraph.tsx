import { memo, useState, useCallback, useMemo } from 'react';
import type { FlameGraphFrame } from '@behavior-tree-ist/core/inspector';
import { formatMs } from '../../utils/format';

const BAR_HEIGHT = 24;
const BAR_GAP = 1;
const MIN_TEXT_WIDTH = 36;
const ROW_HEIGHT = BAR_HEIGHT + BAR_GAP;
const PADDING_TOP = 4;
const PADDING_BOTTOM = 4;

interface FlameGraphProps {
  frames: FlameGraphFrame[];
  onSelectNode: (nodeId: number) => void;
  selectedNodeId: number | null;
}

interface TooltipInfo {
  x: number;
  y: number;
  frame: FlameGraphFrame;
  tickTotal: number;
}

function getMaxDepth(frames: FlameGraphFrame[]): number {
  let max = 0;
  for (const frame of frames) {
    const childMax = frame.children.length > 0 ? getMaxDepth(frame.children) : 0;
    max = Math.max(max, frame.depth, childMax);
  }
  return max;
}

function selfTimeFraction(frame: FlameGraphFrame): number {
  if (frame.inclusiveTime <= 0) return 0;
  return frame.selfTime / frame.inclusiveTime;
}

function heatColor(fraction: number): string {
  // Map 0..1 to cool (blue-ish) → warm (orange/red)
  // Using HSL: cold = 210 (blue), hot = 15 (orange-red)
  const hue = 210 - fraction * 195;
  const saturation = 55 + fraction * 25;
  const lightness = 52 - fraction * 10;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

interface FlatBar {
  frame: FlameGraphFrame;
  x: number;
  width: number;
  y: number;
}

export function countFrames(frames: FlameGraphFrame[]): number {
  let count = 0;
  for (const frame of frames) {
    count += 1 + countFrames(frame.children);
  }
  return count;
}

function computeBars(
  frames: FlameGraphFrame[],
  totalWidth: number,
): FlatBar[] {
  if (frames.length === 0) return [];

  const bars: FlatBar[] = [];

  function layoutChildren(
    children: FlameGraphFrame[],
    parentX: number,
    parentWidth: number,
    parentInclusiveTime: number,
  ) {
    const totalChildTime = children.reduce((sum, c) => sum + c.inclusiveTime, 0);
    let currentX = parentX;

    for (const child of children) {
      let childWidth: number;
      if (totalChildTime > 0 && parentInclusiveTime > 0) {
        // Proportional to inclusive time within parent bounds
        childWidth = (child.inclusiveTime / parentInclusiveTime) * parentWidth;
      } else {
        // Equal distribution when times are zero or too small
        childWidth = parentWidth / children.length;
      }

      const y = PADDING_TOP + child.depth * ROW_HEIGHT;
      bars.push({ frame: child, x: currentX, width: childWidth, y });

      if (child.children.length > 0) {
        layoutChildren(child.children, currentX, childWidth, child.inclusiveTime);
      }

      currentX += childWidth;
    }
  }

  // Layout root frames across the full width
  const totalRootTime = frames.reduce((sum, f) => sum + f.inclusiveTime, 0);
  let currentX = 0;

  for (const frame of frames) {
    const width = totalRootTime > 0
      ? (frame.inclusiveTime / totalRootTime) * totalWidth
      : totalWidth / frames.length;

    const y = PADDING_TOP + frame.depth * ROW_HEIGHT;
    bars.push({ frame, x: currentX, width, y });

    if (frame.children.length > 0) {
      layoutChildren(frame.children, currentX, width, frame.inclusiveTime);
    }

    currentX += width;
  }

  return bars;
}

function FlameGraphInner({ frames, onSelectNode, selectedNodeId }: FlameGraphProps) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const totalWidth = 800;
  const tickTotal = frames.reduce((sum, frame) => sum + frame.inclusiveTime, 0);

  const maxDepth = useMemo(() => getMaxDepth(frames), [frames]);
  const svgHeight = PADDING_TOP + PADDING_BOTTOM + (maxDepth + 1) * ROW_HEIGHT;

  const bars = useMemo(
    () => computeBars(frames, totalWidth),
    [frames, totalWidth],
  );

  if (frames.length === 0) {
    return (
      <div className="bt-flamegraph__empty">
        No profiling data available for this tick.
      </div>
    );
  }

  return (
    <div className="bt-flamegraph" onMouseLeave={handleMouseLeave}>
      <svg
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        preserveAspectRatio="none"
        className="bt-flamegraph__svg"
      >
        {bars.map((bar) => {
          const isSelected = bar.frame.nodeId === selectedNodeId;
          const fraction = selfTimeFraction(bar.frame);
          const color = heatColor(fraction);
          const textFits = bar.width > MIN_TEXT_WIDTH;

          return (
            <g
              key={`${bar.frame.nodeId}-${bar.frame.depth}`}
              className={`bt-flamegraph__bar ${isSelected ? 'bt-flamegraph__bar--selected' : ''}`}
              onClick={() => onSelectNode(bar.frame.nodeId)}
              onMouseMove={(e) => {
                setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  frame: bar.frame,
                  tickTotal,
                });
              }}
            >
              <rect
                x={bar.x}
                y={bar.y}
                width={Math.max(bar.width - BAR_GAP, 1)}
                height={BAR_HEIGHT}
                fill={color}
                rx={2}
              />
              {isSelected && (
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={Math.max(bar.width - BAR_GAP, 1)}
                  height={BAR_HEIGHT}
                  fill="none"
                  stroke="var(--bt-accent-color)"
                  strokeWidth={2}
                  rx={2}
                />
              )}
              {textFits && (
                <text
                  x={bar.x + 4}
                  y={bar.y + BAR_HEIGHT / 2}
                  dominantBaseline="central"
                  className="bt-flamegraph__label"
                >
                  <tspan>{bar.frame.name}</tspan>
                  <tspan className="bt-flamegraph__label-time">
                    {` ${formatMs(bar.frame.inclusiveTime)}`}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="bt-flamegraph__tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div className="bt-flamegraph__tooltip-name">{tooltip.frame.name}</div>
          <div className="bt-flamegraph__tooltip-row">
            <span className="bt-flamegraph__tooltip-label">Inclusive</span>
            <span className="bt-flamegraph__tooltip-value">{formatMs(tooltip.frame.inclusiveTime)}</span>
          </div>
          <div className="bt-flamegraph__tooltip-row">
            <span className="bt-flamegraph__tooltip-label">Self</span>
            <span className="bt-flamegraph__tooltip-value">{formatMs(tooltip.frame.selfTime)}</span>
          </div>
          {tooltip.tickTotal > 0 && (
            <div className="bt-flamegraph__tooltip-row">
              <span className="bt-flamegraph__tooltip-label">% of tick</span>
              <span className="bt-flamegraph__tooltip-value">
                {((tooltip.frame.inclusiveTime / tooltip.tickTotal) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const FlameGraph = memo(FlameGraphInner);
