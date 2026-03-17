import { describe, it, expect, vi } from 'vitest';
import {
    DEMO_UI_KEYPAIR,
    base64urlEncode,
    generateEphemeralKeyPair,
    sealSessionSeed,
    encodeHeaderToken,
    getRandomBytes,
} from '@bt-studio/studio-plugins';
import { SessionManager } from './session-manager';
import type { AppRouter } from '@bt-studio/studio-server';
import { type TRPCClient } from '@trpc/client';

/**
 * Simulate the headerToken an agent would produce when it handshakes to the MCP's public key.
 * Mirrors the logic in repl-crypto.ts: encodeHeaderToken(ephPub, nonce, ciphertext)
 */
function makeHeaderToken(mcpPublicKey: Uint8Array): string {
    const { publicKey: ephPub, secretKey: ephSec } = generateEphemeralKeyPair();
    const seed = getRandomBytes(32);
    const sealed = sealSessionSeed(seed, mcpPublicKey, ephSec);
    return encodeHeaderToken({ version: 1, clientEphemeralPublicKey: ephPub, nonce: sealed.nonce, ciphertext: sealed.box });
}

describe('SessionManager', () => {
    it('exposes the public key derived from private key', () => {
        const trpc = {} as unknown as TRPCClient<AppRouter>;
        const manager = new SessionManager(DEMO_UI_KEYPAIR.secretKey, trpc);

        expect(base64urlEncode(manager.publicKey)).toHaveLength(43);
    });

    it('ensureHandshake calls trpc.repl.handshake and completes handshake', async () => {
        const mcpPrivateKey = DEMO_UI_KEYPAIR.secretKey;
        const mcpPublicKey = DEMO_UI_KEYPAIR.publicKey;
        const headerToken = makeHeaderToken(mcpPublicKey);

        const mockHandshake = vi.fn().mockResolvedValue({ headerToken });
        const trpc = {
            repl: {
                handshake: { query: mockHandshake },
            },
        } as unknown as TRPCClient<AppRouter>;

        const manager = new SessionManager(mcpPrivateKey, trpc);
        const client = await manager.ensureHandshake('my-agent', 'my-session');

        expect(mockHandshake).toHaveBeenCalledWith({ clientId: 'my-agent', sessionId: 'my-session' });
        expect(client.isReady).toBe(true);
    });

    it('reuses existing ready session without re-handshaking', async () => {
        const headerToken = makeHeaderToken(DEMO_UI_KEYPAIR.publicKey);

        const mockHandshake = vi.fn().mockResolvedValue({ headerToken });
        const trpc = {
            repl: { handshake: { query: mockHandshake } },
        } as unknown as TRPCClient<AppRouter>;

        const manager = new SessionManager(DEMO_UI_KEYPAIR.secretKey, trpc);
        await manager.ensureHandshake('agent', 'session');
        await manager.ensureHandshake('agent', 'session');

        expect(mockHandshake).toHaveBeenCalledTimes(1);
    });

    it('rehandshake resets and re-fetches token', async () => {
        const headerToken = makeHeaderToken(DEMO_UI_KEYPAIR.publicKey);

        const mockHandshake = vi.fn().mockResolvedValue({ headerToken });
        const trpc = {
            repl: { handshake: { query: mockHandshake } },
        } as unknown as TRPCClient<AppRouter>;

        const manager = new SessionManager(DEMO_UI_KEYPAIR.secretKey, trpc);
        await manager.ensureHandshake('agent', 'session');

        // fresh headerToken for re-handshake
        const headerToken2 = makeHeaderToken(DEMO_UI_KEYPAIR.publicKey);
        mockHandshake.mockResolvedValue({ headerToken: headerToken2 });

        await manager.rehandshake('agent', 'session');

        expect(mockHandshake).toHaveBeenCalledTimes(2);
    });

    it('throws clear error when handshake fails due to key mismatch', async () => {
        // Agent sealed to a DIFFERENT public key (not the MCP's)
        const { publicKey: wrongPub } = generateEphemeralKeyPair();
        const badToken = makeHeaderToken(wrongPub);

        const mockHandshake = vi.fn().mockResolvedValue({ headerToken: badToken });
        const trpc = {
            repl: { handshake: { query: mockHandshake } },
        } as unknown as TRPCClient<AppRouter>;

        const manager = new SessionManager(DEMO_UI_KEYPAIR.secretKey, trpc);

        await expect(manager.ensureHandshake('agent', 'session')).rejects.toThrow(
            'not configured with this MCP',
        );
    });
});
