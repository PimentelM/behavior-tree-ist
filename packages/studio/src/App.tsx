import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import type { SerializableNode, TickRecord } from '@behavior-tree-ist/core';
import { useEffect, useState } from 'react';
import type { TreeWorkerEvent, TreeWorkerRequest } from './tree-worker-protocol';

const TICK_RATE = 20;
const UPDATE_RATE = TICK_RATE * 15;
const BUFFER_TIME_S = 20;

function App() {
    const [tree, setTree] = useState<SerializableNode | null>(null);
    const [ticks, setTicks] = useState<TickRecord[]>([]);

    useEffect(() => {
        const worker = new Worker(new URL('./tree-tick.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (event: MessageEvent<TreeWorkerEvent>) => {
            const message = event.data;
            if (message.type === 'tree') {
                setTree(message.tree);
                return;
            }

            if (message.type === 'ticks') {
                setTicks((prev) => [...prev, ...message.ticks]);
                return;
            }

            console.error(`[tree-worker] ${message.message}`);
        };

        worker.onerror = (event) => {
            console.error('[tree-worker] fatal worker error', event.message);
        };

        const startMessage: TreeWorkerRequest = {
            type: 'start',
            tickRateMs: TICK_RATE,
            updateRateMs: UPDATE_RATE
        };
        worker.postMessage(startMessage);

        return () => {
            const stopMessage: TreeWorkerRequest = { type: 'stop' };
            worker.postMessage(stopMessage);
            worker.terminate();
        };
    }, []);

    if (tree === null) {
        return (
            <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center' }}>
                Preparing behavior tree worker...
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ padding: '0 20px', background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
                <h1 style={{ margin: '12px 0' }}>Behavior Tree Studio</h1>
            </header>
            <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                <BehaviourTreeDebugger
                    tree={tree}
                    ticks={ticks}
                    isolateStyles={true}
                    inspectorOptions={{
                        maxTicks: (1000 / TICK_RATE) * BUFFER_TIME_S
                    }} />
            </main>
        </div>
    );
}

export default App;
