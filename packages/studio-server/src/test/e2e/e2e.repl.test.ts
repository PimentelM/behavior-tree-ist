import { randomUUID } from 'crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node';
import { Action, BehaviourTree, NodeResult, StudioAgent, StudioLink, TreeRegistry } from '@bt-studio/core';
import {
    DEMO_SERVER_KEYPAIR,
    ReplPlugin,
    type DirectionalKeys,
    bytesToJson,
    decodeEnvelope,
    decodeHeaderToken,
    deriveDirectionalKeys,
    encodeEnvelope,
    jsonToBytes,
    openSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
} from '@bt-studio/studio-plugins';
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
    let sessionKeys: DirectionalKeys;

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

        // In E2E mode, agent seals its session seed to the "UI" public key.
        // DEMO_SERVER_KEYPAIR acts as the demo UI keypair.
        const replPlugin = new ReplPlugin({ serverPublicKey: DEMO_SERVER_KEYPAIR.publicKey });
        agent.registerPlugin(replPlugin);

        agent.start();

        await waitFor(() => agent.isConnected);
        // Allow handshake message to reach the server
        await delay(200);

        // Retrieve the agent's headerToken (relayed by server) and derive session keys
        // acting as the UI using the demo keypair.
        const handshake = await service.trpc.repl.handshake.query({ clientId, sessionId });
        const { clientEphemeralPublicKey, nonce, ciphertext } = decodeHeaderToken(handshake.headerToken);
        const sessionSeed = openSessionSeed(
            { nonce, box: ciphertext },
            clientEphemeralPublicKey,
            DEMO_SERVER_KEYPAIR.secretKey,
        );
        sessionKeys = deriveDirectionalKeys(sessionSeed);

        agent.tick();
        await delay(50);
    });

    afterEach(async () => {
        agent.destroy();
        await delay(100);
    });

    async function evalCode(code: string): Promise<{ kind: string; text: string; consoleOutput?: string[] }> {
        const { nonce, box } = secretboxEncrypt(jsonToBytes({ type: 'eval', code }), sessionKeys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);
        const response = await service.trpc.repl.eval.mutate({ clientId, sessionId, encryptedPayload });
        const { nonce: rNonce, ciphertext: rBox } = decodeEnvelope(response.encryptedPayload);
        const plaintext = secretboxDecrypt(rNonce, rBox, sessionKeys.c2s);
        return bytesToJson(plaintext);
    }

    async function getCompletions(prefix: string, maxResults?: number): Promise<{ completions: string[] }> {
        const { nonce, box } = secretboxEncrypt(
            jsonToBytes({ type: 'completions', prefix, maxResults }),
            sessionKeys.s2c,
        );
        const encryptedPayload = encodeEnvelope(nonce, box);
        const response = await service.trpc.repl.completions.mutate({ clientId, sessionId, encryptedPayload });
        const { nonce: rNonce, ciphertext: rBox } = decodeEnvelope(response.encryptedPayload);
        const plaintext = secretboxDecrypt(rNonce, rBox, sessionKeys.c2s);
        return bytesToJson(plaintext);
    }

    it('evaluates a simple expression and returns result', async () => {
        const result = await evalCode('1 + 1');

        expect(result).toMatchObject({ kind: 'result', text: '2' });
    });

    it('evaluates string expression', async () => {
        const result = await evalCode('"hello world"');

        expect(result).toMatchObject({ kind: 'result', text: 'hello world' });
    });

    it('captures console output', async () => {
        const result = await evalCode('console.log("test output"); 42');

        expect(result).toMatchObject({ kind: 'result', text: '42' });
        expect(result.consoleOutput).toContain('test output');
    });

    it('returns error for invalid code', async () => {
        const result = await evalCode('throw new Error("test error")');

        expect(result.kind).toBe('error');
        expect(result.text).toContain('test error');
    });

    it('returns completions for prefix', async () => {
        const result = await getCompletions('Math.');

        expect(result.completions).toContain('abs');
        expect(result.completions).toContain('floor');
        expect(result.completions.length).toBeGreaterThan(0);
    });

    it('returns empty completions for unknown prefix', async () => {
        const result = await getCompletions('xyznonexistent123.');

        expect(result.completions).toEqual([]);
    });

    it('persists variables across eval calls', async () => {
        await evalCode('let x = 42');

        const result = await evalCode('x');

        expect(result).toMatchObject({ kind: 'result', text: '42' });
    });

    it('handles async evaluation', async () => {
        const result = await evalCode('await Promise.resolve("async result")');

        expect(result).toMatchObject({ kind: 'result', text: 'async result' });
    });

    it('rejects eval for disconnected agent', async () => {
        agent.destroy();
        await delay(200);

        await expect(
            service.trpc.repl.eval.mutate({
                clientId,
                sessionId,
                encryptedPayload: 'dummy-payload',
            }),
        ).rejects.toThrow();
    });
});
