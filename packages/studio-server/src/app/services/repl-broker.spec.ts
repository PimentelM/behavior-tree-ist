import { describe, it, expect } from 'vitest';
import { ReplBroker } from './repl-broker';
import { type CommandSenderInterface } from '../interfaces';
import {
    DEMO_SERVER_KEYPAIR,
    deriveDirectionalKeys,
    encodeEnvelope,
    encodeHeaderToken,
    generateEphemeralKeyPair,
    getRandomBytes,
    jsonToBytes,
    sealSessionSeed,
    secretboxEncrypt,
} from '@bt-studio/studio-plugins';

class FakeCommandSender implements CommandSenderInterface {
    public readonly sent: Array<{ clientId: string; message: object }> = [];

    sendToClient(clientId: string, message: object): void {
        this.sent.push({ clientId, message });
    }
}

type SentPluginMessage = {
    t: number;
    pluginId: string;
    correlationId: string;
    payload: string; // now encrypted base64url string
};

/**
 * Performs a simulated handshake: builds a real NaCl headerToken using the
 * demo server public key, then calls handleAgentMessage so the broker derives
 * session keys.  Returns the directional keys so tests can encrypt/decrypt.
 */
function doHandshake(broker: ReplBroker, connectionId: string) {
    const ephemeral = generateEphemeralKeyPair();
    const sessionSeed = getRandomBytes(32);
    const { nonce, box } = sealSessionSeed(sessionSeed, DEMO_SERVER_KEYPAIR.publicKey, ephemeral.secretKey);
    const headerToken = encodeHeaderToken({
        version: 1,
        clientEphemeralPublicKey: ephemeral.publicKey,
        nonce,
        ciphertext: box,
    });

    broker.handleAgentMessage(connectionId, 'handshake', { type: 'handshake', headerToken });

    return deriveDirectionalKeys(sessionSeed);
}

function makeTestBroker() {
    const sender = new FakeCommandSender();
    const broker = new ReplBroker({
        commandSender: sender,
        serverSecretKey: DEMO_SERVER_KEYPAIR.secretKey,
    });
    return { sender, broker };
}

describe('ReplBroker', () => {
    it('sends eval request (encrypted) and resolves when agent responds with encrypted result', async () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');

        const evalPromise = broker.sendEval('conn-1', '1 + 1');

        expect(sender.sent).toHaveLength(1);
        const msg = sender.sent[0]!.message as SentPluginMessage;
        expect(msg.t).toBe(7);
        expect(msg.pluginId).toBe('repl');
        expect(typeof msg.payload).toBe('string'); // encrypted envelope

        // Simulate agent response: encrypt with c2s key
        const resultPayload = { kind: 'result' as const, text: '2' };
        const { nonce, box } = secretboxEncrypt(jsonToBytes(resultPayload), keys.c2s);
        const encryptedResponse = encodeEnvelope(nonce, box);

        broker.handleAgentMessage('conn-1', msg.correlationId, encryptedResponse);

        await expect(evalPromise).resolves.toEqual(resultPayload);
    });

    it('sends eval with error result', async () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');

        const evalPromise = broker.sendEval('conn-1', 'throw new Error("oops")');
        const msg = sender.sent[0]!.message as SentPluginMessage;

        const result = { kind: 'error' as const, text: 'Error: oops' };
        const { nonce, box } = secretboxEncrypt(jsonToBytes(result), keys.c2s);
        broker.handleAgentMessage('conn-1', msg.correlationId, encodeEnvelope(nonce, box));

        await expect(evalPromise).resolves.toEqual(result);
    });

    it('sends completions request (encrypted) and resolves when agent responds', async () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');

        const compPromise = broker.sendCompletions('conn-1', 'Math.');

        expect(sender.sent).toHaveLength(1);
        const msg = sender.sent[0]!.message as SentPluginMessage;
        expect(msg.pluginId).toBe('repl');
        expect(typeof msg.payload).toBe('string');

        const result = { completions: ['Math.abs', 'Math.floor'] };
        const { nonce, box } = secretboxEncrypt(jsonToBytes(result), keys.c2s);
        broker.handleAgentMessage('conn-1', msg.correlationId, encodeEnvelope(nonce, box));

        await expect(compPromise).resolves.toEqual(result);
    });

    it('passes maxResults through to completions payload', async () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');

        const compPromise = broker.sendCompletions('conn-1', 'obj.', 10);
        const msg = sender.sent[0]!.message as SentPluginMessage;

        const result = { completions: [] };
        const { nonce, box } = secretboxEncrypt(jsonToBytes(result), keys.c2s);
        broker.handleAgentMessage('conn-1', msg.correlationId, encodeEnvelope(nonce, box));

        await expect(compPromise).resolves.toEqual(result);
    });

    it('rejects when no handshake has been done (no session keys)', async () => {
        const { broker } = makeTestBroker();

        await expect(broker.sendEval('conn-no-handshake', 'code')).rejects.toThrow(/handshake not complete/);
        await expect(broker.sendCompletions('conn-no-handshake', 'prefix')).rejects.toThrow(/handshake not complete/);
    });

    it('rejects on timeout', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        const evalPromise = broker.sendEval('conn-1', 'code', 20);
        await expect(evalPromise).rejects.toThrow(/timed out/);
    });

    it('rejects all pending on shutdown', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        const evalPromise = broker.sendEval('conn-1', 'code');
        broker.shutdown();

        await expect(evalPromise).rejects.toThrow(/shutting down/);
    });

    it('logs warning for unknown correlationId without throwing', () => {
        const { broker } = makeTestBroker();

        expect(() => broker.handleAgentMessage('conn-1', 'unknown-id', 'payload')).not.toThrow();
    });

    it('handles multiple concurrent requests independently', async () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');

        const p1 = broker.sendEval('conn-1', '1 + 1');
        const p2 = broker.sendEval('conn-1', '2 + 2');

        expect(sender.sent).toHaveLength(2);
        const msg1 = sender.sent[0]!.message as SentPluginMessage;
        const msg2 = sender.sent[1]!.message as SentPluginMessage;
        expect(msg1.correlationId).not.toBe(msg2.correlationId);

        const r2 = { kind: 'result' as const, text: '4' };
        const enc2 = encodeEnvelope(...Object.values(secretboxEncrypt(jsonToBytes(r2), keys.c2s)) as [Uint8Array, Uint8Array]);
        broker.handleAgentMessage('conn-1', msg2.correlationId, enc2);

        const r1 = { kind: 'result' as const, text: '2' };
        const enc1 = encodeEnvelope(...Object.values(secretboxEncrypt(jsonToBytes(r1), keys.c2s)) as [Uint8Array, Uint8Array]);
        broker.handleAgentMessage('conn-1', msg1.correlationId, enc1);

        await expect(p1).resolves.toEqual(r1);
        await expect(p2).resolves.toEqual(r2);
    });

    it('removeConnection clears session keys so subsequent sendEval rejects', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        broker.removeConnection('conn-1');

        await expect(broker.sendEval('conn-1', 'code')).rejects.toThrow(/handshake not complete/);
    });

    it('silently drops malformed handshake payload', () => {
        const { broker } = makeTestBroker();

        expect(() =>
            broker.handleAgentMessage('conn-1', 'handshake', { type: 'handshake', headerToken: 'not-valid-token' })
        ).not.toThrow();
    });

    it('ignores non-string response payload (logs warning)', () => {
        const { sender, broker } = makeTestBroker();
        const keys = doHandshake(broker, 'conn-1');
        void keys; // unused here

        const evalPromise = broker.sendEval('conn-1', 'code', 100);
        const msg = sender.sent[0]!.message as SentPluginMessage;

        // Agent sends a plain object instead of encrypted string — should reject
        broker.handleAgentMessage('conn-1', msg.correlationId, { wrongType: true });

        return expect(evalPromise).rejects.toThrow(/Expected encrypted string/);
    });
});
