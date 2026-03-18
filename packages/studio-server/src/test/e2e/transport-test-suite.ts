import { randomUUID } from 'crypto';
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    Action,
    BehaviourTree,
    type InboundMessage,
    NodeResult,
    type OutboundMessage,
    StudioAgent,
    StudioCommandType,
    StudioLink,
    type TransportData,
    type TransportFactory,
    TreeRegistry,
} from '@bt-studio/core';
import { withTestService, type TestServiceInstance } from '../test-service-setup';
import {
    createClientInputStub,
    createCommandInputStub,
    createSessionInputStub,
    createTickQueryInputStub,
    createTreeInputStub,
    createTreeScopeStub,
} from '../stubs';

export interface StudioServerE2ETransportConfig {
    name: string;
    createTransportFactory: (service: TestServiceInstance) => TransportFactory;
    serialize?: (message: OutboundMessage) => TransportData;
    deserialize?: (data: TransportData) => InboundMessage;
}

async function waitFor(
    predicate: () => Promise<boolean>,
    timeoutMs = 5000,
    pollMs = 50,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function defineStudioServerE2ETests(config: StudioServerE2ETransportConfig): void {
    describe(config.name, () => {
        const testService = withTestService();
        let service: TestServiceInstance;
        let clientId: string;
        let sessionId: string;
        let treeId: string;

        let trpc: TestServiceInstance['trpc'];
        let registry: TreeRegistry;
        let tree: BehaviourTree;
        let agent: StudioAgent;

        beforeAll(async () => {
            service = await testService.beforeAll();
            trpc = service.trpc;
        });

        beforeEach(async () => {
            const scopeId = randomUUID();
            const scope = createTreeScopeStub({
                clientId: `test-client-${scopeId}`,
                sessionId: `test-session-${scopeId}`,
                treeId: `test-tree-${scopeId}`,
            });

            clientId = scope.clientId;
            sessionId = scope.sessionId;
            treeId = scope.treeId;

            tree = new BehaviourTree(Action.from('TestAction', () => NodeResult.Succeeded));
            registry = new TreeRegistry();
            registry.register(treeId, tree);

            const link = new StudioLink({
                createTransport: config.createTransportFactory(service),
                reconnectDelayMs: 100,
                serialize: config.serialize,
                deserialize: config.deserialize,
            });

            agent = new StudioAgent({
                clientId,
                sessionId,
                registry,
                link,
            });

            agent.start();
             
            await waitFor(async () => agent.isConnected);
            await delay(50);
            agent.tick();
            await delay(50);
        });

        afterEach(async () => {
            agent.destroy();
            await delay(100);
        });

        afterAll(async () => {
            await testService.afterAll();
        });

        it('registers the client via tRPC after agent connects', async () => {
            const clients = await trpc.clients.getAll.query();
            const client = clients.find((entry) => entry.clientId === clientId);

            expect(client).toBeDefined();
            expect(client).toMatchObject({
                clientId,
                online: true,
            });
        });

        it('registers the session via tRPC after agent connects', async () => {
            const sessions = await trpc.sessions.getByClientId.query({
                ...createClientInputStub({ clientId }),
            });

            expect(sessions).toHaveLength(1);
            expect(sessions[0]).toMatchObject({
                clientId,
                sessionId,
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
                    ...createSessionInputStub({ clientId, sessionId }),
                });
                return trees.length > 0;
            });

            expect(trees).toHaveLength(1);
            expect(trees[0]).toMatchObject({
                clientId,
                sessionId,
                treeId,
            });
            expect((trees[0] as (typeof trees)[number]).serializedTree).toHaveProperty('name');
        });

        it('retrieves a specific tree by id', async () => {
            const treeRecord = await trpc.trees.getById.query({
                ...createTreeInputStub({ clientId, sessionId, treeId }),
            });

            expect(treeRecord).not.toBeNull();
            expect(treeRecord?.treeId).toBe(treeId);
        });

        it('streams ticks after enabling streaming via command', async () => {
            const enableResult = await trpc.commands.send.mutate({
                ...createTreeInputStub({ clientId, sessionId, treeId }),
                command: StudioCommandType.EnableStreaming,
            });
            expect(enableResult).toMatchObject({ success: true });

            tree.tick();
            tree.tick();
            tree.tick();

            await waitFor(async () => {
                const ticks = await trpc.ticks.query.query({
                    ...createTickQueryInputStub({ clientId, sessionId, treeId }),
                });
                return ticks.length >= 3;
            });

            const ticks = await trpc.ticks.query.query({
                ...createTickQueryInputStub({ clientId, sessionId, treeId }),
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
                    clientId,
                    sessionId,
                    treeId,
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
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.EnableStateTrace,
                }),
            });
            expect(enableResult).toMatchObject({ success: true });

            const statusAfterEnable = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.GetTreeStatuses,
                }),
            });
            expect(statusAfterEnable).toMatchObject({
                success: true,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({ stateTrace: true }),
            });

            const disableResult = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.DisableStateTrace,
                }),
            });
            expect(disableResult).toMatchObject({ success: true });

            const statusAfterDisable = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.GetTreeStatuses,
                }),
            });
            expect(statusAfterDisable).toMatchObject({
                success: true,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({ stateTrace: false }),
            });
        });

        it('enables and disables profiling via command', async () => {
            const enableResult = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.EnableProfiling,
                }),
            });
            expect(enableResult).toMatchObject({ success: true });

            const statusAfterEnable = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.GetTreeStatuses,
                }),
            });
            expect(statusAfterEnable).toMatchObject({
                success: true,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                data: expect.objectContaining({ profiling: true }),
            });

            const disableResult = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.DisableProfiling,
                }),
            });
            expect(disableResult).toMatchObject({ success: true });
        });

        it('disables streaming and stops receiving ticks', async () => {
            const disableResult = await trpc.commands.send.mutate({
                ...createCommandInputStub({
                    clientId,
                    sessionId,
                    treeId,
                    command: StudioCommandType.DisableStreaming,
                }),
            });
            expect(disableResult).toMatchObject({ success: true });

            const ticksBefore = await trpc.ticks.query.query({
                ...createTickQueryInputStub({ clientId, sessionId, treeId }),
            });
            const countBefore = ticksBefore.length;

            tree.tick();
            tree.tick();
            await delay(200);

            const ticksAfter = await trpc.ticks.query.query({
                ...createTickQueryInputStub({ clientId, sessionId, treeId }),
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
            const clientsBefore = await trpc.clients.getAll.query();
            const clientBefore = clientsBefore.find((entry) => entry.clientId === clientId);
            expect(clientBefore).toBeDefined();
            expect(clientBefore?.online).toBe(true);

            agent.destroy();
            await delay(200);

            const clientsAfter = await trpc.clients.getAll.query();
            const clientAfter = clientsAfter.find((entry) => entry.clientId === clientId);

            expect(clientAfter).toBeDefined();
            expect(clientAfter).toMatchObject({
                clientId,
                online: false,
            });
        });
    });
}
