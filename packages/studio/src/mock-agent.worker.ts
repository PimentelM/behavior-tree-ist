import { parentPort, workerData } from 'node:worker_threads';
import * as coreStudioModule from '../../core/src/studio/index.ts';
import { connectNodeWebSocket } from '../../transports/src/index.ts';
import { createHeavyProfilerDemoTree } from './heavy-profiler-demo-tree';
import { unwrapDefaultExport } from './module-interop';

type MockAgentDriver = 'manual' | 'interval';

type WorkerBootOptions = {
  serverUrl: string;
  tickRateMs: number;
  clientName: string;
  treeName: string;
  treeDescription: string;
  driver: MockAgentDriver;
};

type WorkerCommand =
  | { type: 'tick'; now?: number }
  | { type: 'stop' };

type WorkerEvent =
  | { type: 'ready' }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

const { BehaviourTreeRegistry, StudioAgent } = unwrapDefaultExport(coreStudioModule) as typeof import('../../core/src/studio/index.ts');

const port = parentPort;
if (!port) {
  throw new Error('Mock agent worker requires a parent port');
}

const bootOptions = (workerData as { config: WorkerBootOptions }).config;

const tree = createHeavyProfilerDemoTree();
const registry = new BehaviourTreeRegistry();
const { off: offTree } = registry.registerTree(tree, {
  name: bootOptions.treeName,
  description: bootOptions.treeDescription,
  treeKey: 'heavy-profiler-demo',
});

const agent = new StudioAgent({
  registry,
  clientName: bootOptions.clientName,
  flushIntervalMs: 50,
  heartbeatIntervalMs: 3000,
  maxBatchTicks: 128,
  maxQueuedTicksPerTree: 5000,
});

agent.provideDialer(async () => connectNodeWebSocket(bootOptions.serverUrl));

let timer: NodeJS.Timeout | undefined;
let stopped = false;

function emit(event: WorkerEvent): void {
  port.postMessage(event);
}

function runTick(now = Date.now()): void {
  if (stopped) {
    return;
  }
  tree.tick({ now });
  agent.tick(now);
}

function cleanup(): void {
  if (stopped) {
    return;
  }
  stopped = true;

  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }

  agent.disconnect();
  offTree();
}

async function boot(): Promise<void> {
  try {
    const transport = await connectNodeWebSocket(bootOptions.serverUrl);
    agent.attachTransport(transport);
  } catch {
    // Initial connection can race startup; StudioAgent.tick() will retry.
  }

  if (bootOptions.driver === 'interval') {
    timer = setInterval(() => {
      runTick(Date.now());
    }, bootOptions.tickRateMs);
  }

  emit({ type: 'ready' });
}

port.on('message', (command: WorkerCommand) => {
  switch (command.type) {
    case 'tick':
      runTick(command.now ?? Date.now());
      return;
    case 'stop':
      cleanup();
      emit({ type: 'stopped' });
      return;
  }
});

process.on('uncaughtException', (error) => {
  emit({ type: 'error', message: error instanceof Error ? error.message : 'Unknown mock-agent worker error' });
  cleanup();
});

void boot().catch((error) => {
  emit({ type: 'error', message: error instanceof Error ? error.message : 'Mock-agent worker failed to boot' });
  cleanup();
});
