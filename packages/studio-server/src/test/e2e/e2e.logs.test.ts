import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Action, BehaviourTree, NodeResult, StudioAgent, StudioLink, TreeRegistry } from '@bt-studio/core';
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node';
import { LogsPlugin } from '@bt-studio/studio-plugins';
import { withTestService, type TestServiceInstance } from '../test-service-setup';

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(
    predicate: () => Promise<boolean> | boolean,
    timeoutMs = 5000,
    pollMs = 50,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await predicate()) return;
        await delay(pollMs);
    }
    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

describe('Logs E2E', () => {
    const testService = withTestService();
    let service: TestServiceInstance;
    let agent: StudioAgent;
    let logsPlugin: LogsPlugin;
    let clientId: string;
    let sessionId: string;

    beforeAll(async () => {
        service = await testService.beforeAll();
    });

    afterAll(async () => {
        await testService.afterAll();
    });

    beforeEach(async () => {
        const scopeId = randomUUID();
        clientId = `logs-client-${scopeId}`;
        sessionId = `logs-session-${scopeId}`;

        const tree = new BehaviourTree(Action.from('TestAction', () => NodeResult.Succeeded));
        const registry = new TreeRegistry();
        registry.register(`logs-tree-${scopeId}`, tree);

        const link = new StudioLink({
            createTransport: WsNodeStringTransport.createFactory(service.wsUrl),
            reconnectDelayMs: 100,
        });

        logsPlugin = new LogsPlugin();
        agent = new StudioAgent({ clientId, sessionId, registry, link });
        agent.registerPlugin(logsPlugin);
        agent.start();

        await waitFor(() => agent.isConnected);
        await delay(100);
    });

    afterEach(async () => {
        agent.destroy();
        await delay(100);
    });

    it('persists logs and exposes them through the logs router', async () => {
        logsPlugin.send({
            timestamp: 100,
            level: 2,
            event: 'Boot',
            message: 'ready',
        });
        logsPlugin.send({
            timestamp: 200,
            level: 1,
            event: 'Warn',
            message: 'careful',
        });
        await delay(200);

        const page = await service.trpc.logs.query.query({
            clientId,
            minLevel: 2,
            limit: 10,
        });

        expect(page.items.map((item: { event: string }) => item.event)).toEqual(['Warn', 'Boot']);
        expect(page.nextCursor).toBeNull();
    });
});
