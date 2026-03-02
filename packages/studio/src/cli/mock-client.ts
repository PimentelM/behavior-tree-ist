import { WebSocket } from 'ws';
import { StudioAgent, TreeRegistry, WebSocketTransport } from '@behavior-tree-ist/studio-transport';
import { createHeavyProfilerDemoTree } from '../heavy-profiler-demo-tree';
import { BehaviourTree } from '@behavior-tree-ist/core';

export class MockClientProcess {
    private agent: StudioAgent | null = null;
    private transport: WebSocketTransport | null = null;
    private timer: NodeJS.Timeout | null = null;
    private tree: BehaviourTree | null = null;

    constructor(private readonly url: string, private readonly tickRateMs: number = 50) { }

    public async start(): Promise<void> {
        const registry = new TreeRegistry();
        const tree = createHeavyProfilerDemoTree();
        this.tree = tree;

        setTimeout(() => {
            registry.register('demo-tree-1', tree);
        }, 5000);

        // WebSocketTransport manages the connection itself — pass the URL and the ws implementation
        this.transport = new WebSocketTransport(this.url, {
            WebSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
        });

        this.agent = new StudioAgent(
            `mock-client-${Math.floor(Math.random() * 10000)}`,
            registry
        );

        this.agent.connect(this.transport);

        // The agent will automatically connect when the WebSocket opens
        // We simulate the game loop checking the tree
        this.timer = setInterval(() => {
            if (this.tree) {
                this.tree.tick({ now: Date.now() });
            }
            if (this.agent) {
                this.agent.tick({ now: Date.now() });
            }
        }, this.tickRateMs);

        console.log(`[mock-client] Started ticking demo tree at ${this.tickRateMs}ms`);
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (this.agent) {
            this.agent.disconnect();
            this.agent = null;
        }

        if (this.transport) {
            this.transport.close();
            this.transport = null;
        }

        console.log('[mock-client] Stopped');
    }
}
