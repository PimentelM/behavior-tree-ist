import type { OffFunction } from '@behavior-tree-ist/core';
import type { StudioAgent } from '@behavior-tree-ist/core/studio';

export interface IntervalDriverOptions {
  intervalMs?: number;
  now?: () => number;
}

export function startIntervalDriver(
  agent: StudioAgent,
  options: IntervalDriverOptions = {},
): OffFunction {
  const intervalMs = Math.max(1, Math.floor(options.intervalMs ?? 50));
  const getNow = options.now ?? Date.now;

  const timer = setInterval(() => {
    agent.tick(getNow());
  }, intervalMs);

  return () => {
    clearInterval(timer);
  };
}
