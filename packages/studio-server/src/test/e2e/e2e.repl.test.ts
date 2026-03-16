import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node';
import { Action, BehaviourTree, NodeResult, StudioAgent, StudioLink, TreeRegistry } from '@bt-studio/core';
import { DEMO_SERVER_KEYPAIR, ReplPlugin } from '@bt-studio/studio-plugins';
import { withTestService, type TestServiceInstance } from '../test-service-setup';

async function waitFor(
    predicate: () => Promise<boolean> | boolean,
    timeoutMs = 5000,
    pollMs = 50,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }

    throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('REPL E2E', () => {
    const testService = withTestService();
    let service: TestServiceInstance;
    let clientId: string;
    let sessionId: string;
    let treeId: string;
    let agent: StudioAgent;

    beforeAll(async () => {
        service = await testService.beforeAll();
    });

    afterAll(async () => {
        await testService.afterAll();
    });

    beforeEach(async () => {
        const scopeId = randomUUID();
        clientId = `repl-client-${scopeId}`;
        sessionId = `repl-session-${scopeId}`;
        treeId = `repl-tree-${scopeId}`;

        const tree = new BehaviourTree(Action.from('TestAction', () => NodeResult.Succeeded));
        const registry = new TreeRegistry();
        registry.register(treeId, tree);

        const link = new StudioLink({
            createTransport: WsNodeStringTransport.createFactory(service.wsUrl),
            reconnectDelayMs: 100,
        });

        agent = new StudioAgent({ clientId, sessionId, registry, link });

        const replPlugin = new ReplPlugin({ serverPublicKey: DEMO_SERVER_KEYPAIR.publicKey });
        agent.registerPlugin(replPlugin);

        agent.start();

        await waitFor(() => agent.isConnected);
        // Allow handshake message to reach the server
        await delay(200);

        agent.tick();
        await delay(50);
    });

    afterEach(async () => {
        agent.destroy();
        await delay(100);
    });

    it('evaluates a simple expression and returns result', async () => {
        const result = await service.trpc.repl.eval.mutate({ clientId, sessionId, code: '1 + 1' });

        expect(result).toMatchObject({ kind: 'result', text: '2' });
    });

    it('evaluates string expression', async () => {
        const result = await service.trpc.repl.eval.mutate({ clientId, sessionId, code: '"hello world"' });

        expect(result).toMatchObject({ kind: 'result', text: 'hello world' });
    });

    it('captures console output', async () => {
        const result = await service.trpc.repl.eval.mutate({
            clientId,
            sessionId,
            code: 'console.log("test output"); 42',
        });

        expect(result).toMatchObject({ kind: 'result', text: '42' });
        expect(result.consoleOutput).toContain('test output');
    });

    it('returns error for invalid code', async () => {
        const result = await service.trpc.repl.eval.mutate({
            clientId,
            sessionId,
            code: 'throw new Error("test error")',
        });

        expect(result.kind).toBe('error');
        expect(result.text).toContain('test error');
    });

    it('returns completions for prefix', async () => {
        const result = await service.trpc.repl.completions.mutate({
            clientId,
            sessionId,
            prefix: 'Math.',
        });

        expect(result.completions).toContain('abs');
        expect(result.completions).toContain('floor');
        expect(result.completions.length).toBeGreaterThan(0);
    });

    it('returns empty completions for unknown prefix', async () => {
        const result = await service.trpc.repl.completions.mutate({
            clientId,
            sessionId,
            prefix: 'xyznonexistent123.',
        });

        expect(result.completions).toEqual([]);
    });

    it('persists variables across eval calls', async () => {
        await service.trpc.repl.eval.mutate({ clientId, sessionId, code: 'let x = 42' });

        const result = await service.trpc.repl.eval.mutate({ clientId, sessionId, code: 'x' });

        expect(result).toMatchObject({ kind: 'result', text: '42' });
    });

    it('handles async evaluation', async () => {
        const result = await service.trpc.repl.eval.mutate({
            clientId,
            sessionId,
            code: 'await Promise.resolve("async result")',
        });

        expect(result).toMatchObject({ kind: 'result', text: 'async result' });
    });

    it('rejects eval for disconnected agent', async () => {
        agent.destroy();
        await delay(200);

        await expect(
            service.trpc.repl.eval.mutate({ clientId, sessionId, code: '1 + 1' }),
        ).rejects.toThrow();
    });
});
