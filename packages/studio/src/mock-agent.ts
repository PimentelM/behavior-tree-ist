import type { OffFunction } from '@behavior-tree-ist/core';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

export type MockAgentDriver = 'manual' | 'interval';

export interface MockAgentOptions {
  serverUrl: string;
  tickRateMs?: number;
  clientName?: string;
  treeName?: string;
  treeDescription?: string;
  driver?: MockAgentDriver;
}

export interface RunningMockAgent {
  tick: (now?: number) => void;
  stop: OffFunction;
}

type WorkerCommand =
  | { type: 'tick'; now?: number }
  | { type: 'stop' };

type WorkerEvent =
  | { type: 'ready' }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

function normalizeTickRateMs(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 20;
  }
  return Math.max(1, Math.floor(value));
}

function normalizeDriver(value: MockAgentDriver | undefined): MockAgentDriver {
  return value === 'manual' ? 'manual' : 'interval';
}

export async function startMockAgent(options: MockAgentOptions): Promise<RunningMockAgent> {
  const tickRateMs = normalizeTickRateMs(options.tickRateMs);
  const driver = normalizeDriver(options.driver);
  const clientName = options.clientName ?? 'Studio Mock Agent';
  const treeName = options.treeName ?? 'Heavy Profiler Demo';
  const treeDescription = options.treeDescription ?? 'Synthetic high-load behavior tree for studio debugging';

  const workerEntrypoint = fileURLToPath(new URL('./mock-agent.worker.ts', import.meta.url));
  const workerBootstrap = `
    const { workerData } = require('node:worker_threads');
    require('tsx/cjs');
    require(workerData.entrypoint);
  `;
  const worker = new Worker(workerBootstrap, {
    eval: true,
    workerData: {
      entrypoint: workerEntrypoint,
      config: {
        serverUrl: options.serverUrl,
        tickRateMs,
        clientName,
        treeName,
        treeDescription,
        driver,
      },
    },
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const onMessage = (event: WorkerEvent) => {
      if (event.type === 'ready') {
        settled = true;
        worker.off('message', onMessage);
        resolve();
        return;
      }
      if (event.type === 'error') {
        settled = true;
        worker.off('message', onMessage);
        reject(new Error(event.message));
      }
    };

    worker.on('message', onMessage);
    worker.once('error', (error) => {
      if (settled) return;
      settled = true;
      worker.off('message', onMessage);
      reject(error);
    });

    worker.once('exit', (code) => {
      if (settled) return;
      settled = true;
      worker.off('message', onMessage);
      reject(new Error(`Mock-agent worker exited before ready (code ${code})`));
    });
  });

  let stopped = false;

  const tick = (now?: number) => {
    if (stopped) {
      return;
    }
    const command: WorkerCommand = { type: 'tick', now };
    worker.postMessage(command);
  };

  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;

    const command: WorkerCommand = { type: 'stop' };
    worker.postMessage(command);

    const forceStopTimer = setTimeout(() => {
      void worker.terminate();
    }, 750);

    worker.once('exit', () => {
      clearTimeout(forceStopTimer);
    });
  };

  return { tick, stop };
}
