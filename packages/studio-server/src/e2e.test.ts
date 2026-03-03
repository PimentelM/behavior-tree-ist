import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as net from 'net';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import {
    Action,
    NodeResult,
    BehaviourTree,
    TreeRegistry,
    StudioLink,
    StudioAgent,
    StudioCommandType,
} from '@behavior-tree-ist/core';
import { WsNodeStringTransport } from '@behavior-tree-ist/studio-transport/node';
import { createStudioServer } from './index';
import type { AppRouter } from './app/trpc';
import { TreeRow } from './domain/interfaces';

// ── Helpers ──

async function findAvailablePort(): Promise<number> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

async function waitFor(
    predicate: () => Promise<boolean>,
    timeoutMs = 5000,
    pollMs = 50,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// ── Test suite ──

describe('Studio Server E2E', () => {
    const CLIENT_ID = 'test-client';
    const SESSION_ID = 'test-session';
    const TREE_ID = 'test-tree';

    let port: number;
    let server: ReturnType<typeof createStudioServer>;
    let trpc: ReturnType<typeof createTRPCClient<AppRouter>>;
    let registry: TreeRegistry;
    let tree: BehaviourTree;
    let agent: StudioAgent;

    beforeAll(async () => {
        port = await findAvailablePort();

        server = createStudioServer({
            httpPort: port,
            httpHost: '127.0.0.1',
            sqlitePath: ':memory:',
        });
        await server.start();

        trpc = createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: `http://127.0.0.1:${port}/trpc`,
                }),
            ],
        });

        // Build a simple behaviour tree
        tree = new BehaviourTree(
            Action.from('TestAction', () => NodeResult.Succeeded),
        );

        registry = new TreeRegistry();
        registry.register(TREE_ID, tree);

        // Create the agent with a real WS transport
        const link = new StudioLink({
            createTransport: WsNodeStringTransport.createFactory(
                `ws://127.0.0.1:${port}/ws`,
            ),
            reconnectDelayMs: 100,
        });

        agent = new StudioAgent({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            registry,
            link,
        });

        agent.start();

        // Wait for the agent to connect and the Hello handshake to complete
        await waitFor(async () => agent.isConnected);
        // Give the server a moment to process the Hello + TreeRegistered messages
        await delay(200);
    });

    beforeEach(async () => {
        agent?.tick();

        await delay(100);
    });

    afterAll(async () => {
        agent?.destroy();
        await delay(100);
        await server?.stop();
    });

    it('registers the client via tRPC after agent connects', async () => {
        const clients = await trpc.clients.getAll.query();

        expect(clients).toHaveLength(1);
        expect(clients[0]).toMatchObject({
            client_id: CLIENT_ID,
            online: true,
        });
    });

    it('registers the session via tRPC after agent connects', async () => {
        const sessions = await trpc.sessions.getByClientId.query({
            clientId: CLIENT_ID,
        });

        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
            client_id: CLIENT_ID,
            session_id: SESSION_ID,
            online: true,
        });
    });

    it('registers the tree via tRPC after agent connects', async () => {
        let trees: TreeRow[] = [];
        await waitFor(async () => {
            trees = await trpc.trees.getBySession.query({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
            });
            return trees.length > 0;
        });

        expect(trees).toHaveLength(1);
        expect(trees[0]).toMatchObject({
            client_id: CLIENT_ID,
            session_id: SESSION_ID,
            tree_id: TREE_ID,
        });

        // The serialized tree should be valid JSON
        const serialized = JSON.parse(trees[0].serialized_tree_json);
        expect(serialized).toHaveProperty('name');
    });

    it('retrieves a specific tree by id', async () => {
        const treeRow = await trpc.trees.getById.query({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
        });

        expect(treeRow).not.toBeNull();
        expect(treeRow!.tree_id).toBe(TREE_ID);
    });

    it('streams ticks after enabling streaming via command', async () => {
        // Enable streaming on the tree
        const enableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.EnableStreaming,
        });
        expect(enableResult).toMatchObject({ success: true });

        // Tick the tree a few times
        tree.tick();
        tree.tick();
        tree.tick();

        // Wait for ticks to be persisted on the server
        await waitFor(async () => {
            const ticks = await trpc.ticks.query.query({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
            });
            return ticks.length >= 3;
        });

        const ticks = await trpc.ticks.query.query({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
        });

        expect(ticks.length).toBeGreaterThanOrEqual(3);
        for (const tick of ticks) {
            expect(tick.client_id).toBe(CLIENT_ID);
            expect(tick.session_id).toBe(SESSION_ID);
            expect(tick.tree_id).toBe(TREE_ID);

            const payload = JSON.parse(tick.payload_json);
            expect(payload).toHaveProperty('tickId');
            expect(payload).toHaveProperty('timestamp');
        }
    });

    it('sends GetTreeStatuses command and receives response with data', async () => {
        const response = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.GetTreeStatuses,
        });

        expect(response).toMatchObject({
            success: true,
            data: {
                streaming: true, // we enabled it in the previous test
                stateTrace: false,
                profiling: false,
            },
        });
    });

    it('enables and disables state trace via command', async () => {
        const enableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.EnableStateTrace,
        });
        expect(enableResult).toMatchObject({ success: true });

        // Verify via GetTreeStatuses
        const statusAfterEnable = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.GetTreeStatuses,
        });
        expect(statusAfterEnable).toMatchObject({
            success: true,
            data: expect.objectContaining({ stateTrace: true }),
        });

        const disableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.DisableStateTrace,
        });
        expect(disableResult).toMatchObject({ success: true });

        const statusAfterDisable = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.GetTreeStatuses,
        });
        expect(statusAfterDisable).toMatchObject({
            success: true,
            data: expect.objectContaining({ stateTrace: false }),
        });
    });

    it('enables and disables profiling via command', async () => {
        const enableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.EnableProfiling,
        });
        expect(enableResult).toMatchObject({ success: true });

        const statusAfterEnable = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.GetTreeStatuses,
        });
        expect(statusAfterEnable).toMatchObject({
            success: true,
            data: expect.objectContaining({ profiling: true }),
        });

        const disableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.DisableProfiling,
        });
        expect(disableResult).toMatchObject({ success: true });
    });

    it('disables streaming and stops receiving ticks', async () => {
        const disableResult = await trpc.commands.send.mutate({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
            command: StudioCommandType.DisableStreaming,
        });
        expect(disableResult).toMatchObject({ success: true });

        // Record tick count before
        const ticksBefore = await trpc.ticks.query.query({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
        });
        const countBefore = ticksBefore.length;

        // Tick the tree — these should NOT be persisted
        tree.tick();
        tree.tick();
        await delay(200);

        const ticksAfter = await trpc.ticks.query.query({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
        });

        expect(ticksAfter.length).toBe(countBefore);
    });

    it('reports health check', async () => {
        const health = await trpc.health.check.query();

        expect(health).toMatchObject({
            status: 'ok',
        });
        expect(health.timestamp).toBeTypeOf('number');
        expect(health.uptime).toBeTypeOf('number');
    });

    it('reads and updates settings', async () => {
        const settings = await trpc.settings.get.query();

        expect(settings).toHaveProperty('max_ticks_per_tree');
        expect(settings).toHaveProperty('command_timeout_ms');

        const updated = await trpc.settings.update.mutate({
            maxTicksPerTree: 500,
        });

        expect(updated.max_ticks_per_tree).toBe(500);
    });

    it('marks client offline after agent disconnects', async () => {
        // Agent is still connected at this point — verify
        const clientsBefore = await trpc.clients.getAll.query();
        expect(clientsBefore[0].online).toBe(true);

        agent.destroy();
        await delay(200);

        const clientsAfter = await trpc.clients.getAll.query();

        expect(clientsAfter).toHaveLength(1);
        expect(clientsAfter[0]).toMatchObject({
            client_id: CLIENT_ID,
            online: false,
        });
    });
});
