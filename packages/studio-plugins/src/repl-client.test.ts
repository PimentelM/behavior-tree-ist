import { describe, expect, it } from 'vitest';
import { generateEphemeralKeyPair } from './repl-crypto';
import { ReplPlugin } from './repl-plugin';
import { ReplClient } from './repl-client';
import type { PluginSender } from '@bt-studio/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUiKeyPair() {
    return generateEphemeralKeyPair();
}

/** Build a ReplPlugin attached to a sender; return the sent messages array. */
function attachPlugin(publicKey: Uint8Array): {
    plugin: ReplPlugin;
    sent: { correlationId: string; payload: unknown }[];
} {
    const sent: { correlationId: string; payload: unknown }[] = [];
    const sender: PluginSender = {
        send: (correlationId, payload) => sent.push({ correlationId, payload }),
    };
    const plugin = new ReplPlugin({ publicKey: publicKey });
    plugin.attach(sender);
    return { plugin, sent };
}

/** Extract the headerToken sent by the plugin during attach(). */
function extractHandshakeToken(sent: { correlationId: string; payload: unknown }[]): string {
    const msg = sent[0] as { correlationId: string; payload: { type: string; headerToken: string } };
    return msg.payload.headerToken;
}

// ---------------------------------------------------------------------------
// Constructor + publicKey
// ---------------------------------------------------------------------------

describe('ReplClient constructor', () => {
    it('derives correct public key from private key', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(client.publicKey).toEqual(uiKp.publicKey);
    });

    it('throws on invalid private key length', () => {
        expect(() => new ReplClient(new Uint8Array(16))).toThrow('32 bytes');
    });
});

// ---------------------------------------------------------------------------
// isReady / completeHandshake
// ---------------------------------------------------------------------------

describe('ReplClient isReady', () => {
    it('is false before handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(client.isReady).toBe(false);
    });

    it('is true after successful handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));

        expect(client.isReady).toBe(true);
    });

    it('resets to false after resetSession()', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));
        client.resetSession();

        expect(client.isReady).toBe(false);
    });

    it('throws on malformed headerToken', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(() => { client.completeHandshake('abc'); }).toThrow();
    });

    it('throws when decryption fails (wrong key)', () => {
        const uiKp = makeUiKeyPair();
        const wrongKp = makeUiKeyPair();
        const client = new ReplClient(wrongKp.secretKey);
        const { sent } = attachPlugin(uiKp.publicKey);

        expect(() => { client.completeHandshake(extractHandshakeToken(sent)); }).toThrow('Failed to decrypt handshake');
    });
});

// ---------------------------------------------------------------------------
// encrypt / decrypt round-trips via ReplPlugin
// ---------------------------------------------------------------------------

describe('ReplClient eval round-trip', () => {
    function setupSession() {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { plugin, sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));

        return { client, plugin, sent };
    }

    it('encrypts eval and decrypts agent response', async () => {
        const { client, plugin, sent } = setupSession();

        const encryptedRequest = client.encryptEval('1 + 2');
        await plugin.handleInbound('corr-1', encryptedRequest);

        // sent[0] = handshake, sent[1] = eval response
        expect(sent).toHaveLength(2);
        const encryptedResponse = (sent[1] as { correlationId: string; payload: string }).payload;
        const result = client.decryptEvalResponse(encryptedResponse);

        expect(result.kind).toBe('result');
        expect(result.text).toBe('3');
    });

    it('decryptEvalResponse returns error kind on agent error', async () => {
        const { client, plugin, sent } = setupSession();

        const encryptedRequest = client.encryptEval('throw new Error("boom")');
        await plugin.handleInbound('corr-err', encryptedRequest);

        const encryptedResponse = (sent[1] as { correlationId: string; payload: string }).payload;
        const result = client.decryptEvalResponse(encryptedResponse);

        expect(result.kind).toBe('error');
        expect(result.text).toMatch('boom');
    });
});

describe('ReplClient completions round-trip', () => {
    function setupSession() {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { plugin, sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));

        return { client, plugin, sent };
    }

    it('encrypts completions request and decrypts response', async () => {
        const { client, plugin, sent } = setupSession();

        const encryptedRequest = client.encryptCompletions('Obj', 10);
        await plugin.handleInbound('corr-comp', encryptedRequest);

        const encryptedResponse = (sent[1] as { correlationId: string; payload: string }).payload;
        const result = client.decryptCompletionsResponse(encryptedResponse);

        expect(Array.isArray(result.completions)).toBe(true);
        expect(result.completions.some((c) => c.startsWith('Obj'))).toBe(true);
    });

    it('encryptCompletions without maxResults', async () => {
        const { client, plugin, sent } = setupSession();

        const encryptedRequest = client.encryptCompletions('arr');
        await plugin.handleInbound('corr-comp2', encryptedRequest);

        const encryptedResponse = (sent[1] as { correlationId: string; payload: string }).payload;
        const result = client.decryptCompletionsResponse(encryptedResponse);

        expect(Array.isArray(result.completions)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Error on pre-handshake usage
// ---------------------------------------------------------------------------

describe('ReplClient post-resetSession errors', () => {
    it('encryptEval throws after resetSession', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));
        client.resetSession();

        expect(() => client.encryptEval('1')).toThrow('handshake not complete');
    });

    it('encryptCompletions throws after resetSession', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        const { sent } = attachPlugin(uiKp.publicKey);

        client.completeHandshake(extractHandshakeToken(sent));
        client.resetSession();

        expect(() => client.encryptCompletions('x')).toThrow('handshake not complete');
    });
});

describe('ReplClient pre-handshake errors', () => {
    it('encryptEval throws before handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(() => client.encryptEval('1')).toThrow('handshake not complete');
    });

    it('encryptCompletions throws before handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(() => client.encryptCompletions('x')).toThrow('handshake not complete');
    });

    it('decryptEvalResponse throws before handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(() => client.decryptEvalResponse('abc')).toThrow('handshake not complete');
    });

    it('decryptCompletionsResponse throws before handshake', () => {
        const uiKp = makeUiKeyPair();
        const client = new ReplClient(uiKp.secretKey);
        expect(() => client.decryptCompletionsResponse('abc')).toThrow('handshake not complete');
    });
});
