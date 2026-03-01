import type { OffFunction } from '@behavior-tree-ist/core';
import * as coreStudioModule from '@behavior-tree-ist/core/studio';
import { connectNodeWebSocket } from '@behavior-tree-ist/transports';
import { createHeavyProfilerDemoTree } from './heavy-profiler-demo-tree';
import { unwrapDefaultExport } from './module-interop';

const { BehaviourTreeRegistry, StudioAgent } = unwrapDefaultExport(coreStudioModule) as typeof import('@behavior-tree-ist/core/studio');

export interface MockAgentOptions {
  serverUrl: string;
  tickRateMs?: number;
  clientName?: string;
  treeName?: string;
  treeDescription?: string;
}

export interface RunningMockAgent {
  stop: OffFunction;
}

function normalizeTickRateMs(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 20;
  }
  return Math.max(1, Math.floor(value));
}

export async function startMockAgent(options: MockAgentOptions): Promise<RunningMockAgent> {
  const tickRateMs = normalizeTickRateMs(options.tickRateMs);
  const clientName = options.clientName ?? 'Studio Mock Agent';
  const treeName = options.treeName ?? 'Heavy Profiler Demo';
  const treeDescription = options.treeDescription ?? 'Synthetic high-load behavior tree for studio debugging';

  const tree = createHeavyProfilerDemoTree();
  const registry = new BehaviourTreeRegistry();
  const { off: offTree } = registry.registerTree(tree, {
    name: treeName,
    description: treeDescription,
    treeKey: 'heavy-profiler-demo',
  });

  const agent = new StudioAgent({
    registry,
    clientName,
    flushIntervalMs: 50,
    heartbeatIntervalMs: 3000,
    maxBatchTicks: 128,
    maxQueuedTicksPerTree: 5000,
  });

  agent.provideDialer(async () => connectNodeWebSocket(options.serverUrl));

  try {
    const transport = await connectNodeWebSocket(options.serverUrl);
    agent.attachTransport(transport);
  } catch {
    // Initial connect can fail during startup races. Agent.tick() will retry.
  }

  const timer = setInterval(() => {
    const now = Date.now();
    tree.tick({ now });
    agent.tick(now);
  }, tickRateMs);

  const stop = () => {
    clearInterval(timer);
    agent.disconnect();
    offTree();
  };

  return { stop };
}
