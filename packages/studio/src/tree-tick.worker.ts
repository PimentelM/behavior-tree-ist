import type { BehaviourTree } from '@behavior-tree-ist/core';
import { createHeavyProfilerDemoTree } from './heavy-profiler-demo-tree';
import type { TreeWorkerEvent, TreeWorkerRequest } from './tree-worker-protocol';

let tree: BehaviourTree | null = null;
let timerId: number | undefined;

function postEvent(event: TreeWorkerEvent): void {
    self.postMessage(event);
}

function ensureTree(): BehaviourTree {
    if (tree === null) {
        tree = createHeavyProfilerDemoTree();
        postEvent({ type: 'tree', tree: tree.serialize() });
    }
    return tree;
}

function stopTickLoop(): void {
    if (timerId !== undefined) {
        self.clearInterval(timerId);
        timerId = undefined;
    }
}

self.onmessage = (event: MessageEvent<TreeWorkerRequest>) => {
    const message = event.data;

    if (message.type === 'stop') {
        stopTickLoop();
        return;
    }

    if (message.type === 'start') {
        stopTickLoop();

        const activeTree = ensureTree();
        const tickRateMs = Math.max(1, message.tickRateMs);
        const updateRateMs = Math.max(tickRateMs, message.updateRateMs);
        const burstSize = Math.max(1, Math.floor(updateRateMs / tickRateMs));

        timerId = self.setInterval(() => {
            try {
                const now = Date.now();
                const tickRecords = Array.from({ length: burstSize }).map((_, i) => {
                    const tickNow = now - (tickRateMs * (burstSize - i));
                    return activeTree.tick({ now: tickNow });
                });
                postEvent({ type: 'ticks', ticks: tickRecords });
            } catch (error) {
                const messageText = error instanceof Error ? error.message : 'Unknown worker tick error';
                postEvent({ type: 'error', message: messageText });
            }
        }, updateRateMs);
    }
};
