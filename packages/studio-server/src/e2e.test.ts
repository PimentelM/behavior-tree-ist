import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
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
import { withTestService, type TestServiceInstance } from './test/test-service-setup';
import {
    createClientInputStub,
    createCommandInputStub,
    createSessionInputStub,
    createTickQueryInputStub,
    createTreeInputStub,
    createTreeScopeStub,
} from './stubs';

// ── Helpers ──

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
    const testService = withTestService();
    let CLIENT_ID: string;
    let SESSION_ID: string;
    let TREE_ID: string;

    let wsUrl: string;
    let trpc: TestServiceInstance['trpc'];
    let registry: TreeRegistry;
    let tree: BehaviourTree;
    let agent: StudioAgent;

    beforeAll(async () => {
        const service = await testService.beforeAll();
        wsUrl = service.wsUrl;
        trpc = service.trpc;
    });

    beforeEach(async () => {
        const scopeId = randomUUID();
        const scope = createTreeScopeStub({
            clientId: `test-client-${scopeId}`,
            sessionId: `test-session-${scopeId}`,
            treeId: `test-tree-${scopeId}`,
        });
        CLIENT_ID = scope.clientId;
        SESSION_ID = scope.sessionId;
        TREE_ID = scope.treeId;

        // Build a simple behaviour tree
        tree = new BehaviourTree(
            Action.from('TestAction', () => NodeResult.Succeeded),
        );

        registry = new TreeRegistry();
        registry.register(TREE_ID, tree);

        // Create the agent with a real WS transport
        const link = new StudioLink({
            createTransport: WsNodeStringTransport.createFactory(
                wsUrl,
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
        await delay(50);
        agent?.tick();
        await delay(50);
    });

    afterEach(async () => {
        agent?.destroy();
        await delay(100);
    });

    afterAll(async () => {
        await testService.afterAll();
    });

    it('registers the client via tRPC after agent connects', async () => {
        const clients = await trpc.clients.getAll.query();
        const client = clients.find((entry) => entry.clientId === CLIENT_ID);

        expect(client).toBeDefined();
        expect(client).toMatchObject({
            clientId: CLIENT_ID,
            online: true,
        });
    });

    it('registers the session via tRPC after agent connects', async () => {
        const sessions = await trpc.sessions.getByClientId.query({
            ...createClientInputStub({ clientId: CLIENT_ID }),
        });

        expect(sessions).toHaveLength(1);
        expect(sessions[0]).toMatchObject({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            online: true,
        });
    });

    it('registers the tree via tRPC after agent connects', async () => {
        let trees: Array<{
            clientId: string;
            sessionId: string;
            treeId: string;
            serializedTree: { name?: string };
        }> = [];
        await waitFor(async () => {
            trees = await trpc.trees.getBySession.query({
                ...createSessionInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID }),
            });
            return trees.length > 0;
        });

        expect(trees).toHaveLength(1);
        expect(trees[0]).toMatchObject({
            clientId: CLIENT_ID,
            sessionId: SESSION_ID,
            treeId: TREE_ID,
        });

        expect(trees[0].serializedTree).toHaveProperty('name');
    });

    it('retrieves a specific tree by id', async () => {
        const treeRecord = await trpc.trees.getById.query({
            ...createTreeInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
        });

        expect(treeRecord).not.toBeNull();
        expect(treeRecord!.treeId).toBe(TREE_ID);
    });

    it('streams ticks after enabling streaming via command', async () => {
        // Enable streaming on the tree
        const enableResult = await trpc.commands.send.mutate({
            ...createTreeInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
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
                ...createTickQueryInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
            });
            return ticks.length >= 3;
        });

        const ticks = await trpc.ticks.query.query({
            ...createTickQueryInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
        });

        expect(ticks.length).toBeGreaterThanOrEqual(3);
        for (const tick of ticks) {
            expect(tick).toHaveProperty('tickId');
            expect(tick).toHaveProperty('timestamp');
        }
    });

    it('sends GetTreeStatuses command and receives response with data', async () => {
        const response = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.GetTreeStatuses,
            }),
        });

        expect(response).toMatchObject({
            success: true,
            data: {
                streaming: false,
                stateTrace: false,
                profiling: false,
            },
        });
    });

    it('enables and disables state trace via command', async () => {
        const enableResult = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.EnableStateTrace,
            }),
        });
        expect(enableResult).toMatchObject({ success: true });

        // Verify via GetTreeStatuses
        const statusAfterEnable = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.GetTreeStatuses,
            }),
        });
        expect(statusAfterEnable).toMatchObject({
            success: true,
            data: expect.objectContaining({ stateTrace: true }),
        });

        const disableResult = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.DisableStateTrace,
            }),
        });
        expect(disableResult).toMatchObject({ success: true });

        const statusAfterDisable = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.GetTreeStatuses,
            }),
        });
        expect(statusAfterDisable).toMatchObject({
            success: true,
            data: expect.objectContaining({ stateTrace: false }),
        });
    });

    it('enables and disables profiling via command', async () => {
        const enableResult = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.EnableProfiling,
            }),
        });
        expect(enableResult).toMatchObject({ success: true });

        const statusAfterEnable = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.GetTreeStatuses,
            }),
        });
        expect(statusAfterEnable).toMatchObject({
            success: true,
            data: expect.objectContaining({ profiling: true }),
        });

        const disableResult = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.DisableProfiling,
            }),
        });
        expect(disableResult).toMatchObject({ success: true });
    });

    it('disables streaming and stops receiving ticks', async () => {
        const disableResult = await trpc.commands.send.mutate({
            ...createCommandInputStub({
                clientId: CLIENT_ID,
                sessionId: SESSION_ID,
                treeId: TREE_ID,
                command: StudioCommandType.DisableStreaming,
            }),
        });
        expect(disableResult).toMatchObject({ success: true });

        // Record tick count before
        const ticksBefore = await trpc.ticks.query.query({
            ...createTickQueryInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
        });
        const countBefore = ticksBefore.length;

        // Tick the tree — these should NOT be persisted
        tree.tick();
        tree.tick();
        await delay(200);

        const ticksAfter = await trpc.ticks.query.query({
            ...createTickQueryInputStub({ clientId: CLIENT_ID, sessionId: SESSION_ID, treeId: TREE_ID }),
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

        expect(settings).toHaveProperty('maxTicksPerTree');
        expect(settings).toHaveProperty('commandTimeoutMs');

        const updated = await trpc.settings.update.mutate({
            maxTicksPerTree: 500,
        });

        expect(updated.maxTicksPerTree).toBe(500);
    });

    it('marks client offline after agent disconnects', async () => {
        // Agent is still connected at this point — verify
        const clientsBefore = await trpc.clients.getAll.query();
        const clientBefore = clientsBefore.find((entry) => entry.clientId === CLIENT_ID);
        expect(clientBefore).toBeDefined();
        expect(clientBefore!.online).toBe(true);

        agent.destroy();
        await delay(200);

        const clientsAfter = await trpc.clients.getAll.query();
        const clientAfter = clientsAfter.find((entry) => entry.clientId === CLIENT_ID);

        expect(clientAfter).toBeDefined();
        expect(clientAfter).toMatchObject({
            clientId: CLIENT_ID,
            online: false,
        });
    });
});
