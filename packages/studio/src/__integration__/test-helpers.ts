import { createStudioServer, StudioServer } from '../server/app/server-factory.js';
import { StudioAgent, TreeRegistry, WebSocketTransport } from '@behavior-tree-ist/studio-transport';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../server/app/router.js';
import { WebSocket } from 'ws';

export interface IntegrationTestContext {
    server: StudioServer;
    trpc: ReturnType<typeof createTRPCClient<AppRouter>>;
    clients: StudioAgent[];
    port: number;
    wsPort: number;
}

export async function createTestContext(): Promise<IntegrationTestContext> {
    // Use random ports for isolation in parallel runs, or find a free port
    const port = Math.floor(Math.random() * 10000) + 20000;
    const wsPort = port + 1000;

    const server = createStudioServer({ port, wsPort });

    // Wait a tiny bit for listening
    await new Promise(resolve => setTimeout(resolve, 100));

    const trpc = createTRPCClient<AppRouter>({
        links: [
            httpBatchLink({
                url: `http://localhost:${port}`,
                headers: () => ({ authorization: 'dev-web-token' }),
                fetch: globalThis.fetch,
            }),
        ],
    });

    return { server, trpc, clients: [], port, wsPort };
}

export async function createTestAgent(ctx: IntegrationTestContext, clientId: string, registry: TreeRegistry = new TreeRegistry()): Promise<StudioAgent> {
    const transport = new WebSocketTransport(`ws://localhost:${ctx.wsPort}/ws`, {
        WebSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
    });

    const agent = new StudioAgent(clientId, registry);

    agent.connect(transport);
    ctx.clients.push(agent);

    return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            if (agent.isConnected) {
                clearInterval(interval);
                // Flush queued ClientHello + RegisterTree messages
                agent.tick({ now: Date.now() });
                // Wait for server to process the initial handshake
                setTimeout(() => resolve(agent), 100);
            }
            if (Date.now() - start > 5000) {
                clearInterval(interval);
                reject(new Error('Agent failed to connect after 5s'));
            }
        }, 10);
    });
}

export async function teardownTestContext(ctx: IntegrationTestContext): Promise<void> {
    for (const client of ctx.clients) {
        client.disconnect();
    }
    await ctx.server.close();
}

export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
