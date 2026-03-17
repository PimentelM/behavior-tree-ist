import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config';

describe('loadConfig', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('throws when BT_STUDIO_URL is missing', () => {
        delete process.env['BT_STUDIO_URL'];
        expect(() => loadConfig()).toThrow('BT_STUDIO_URL environment variable is required');
    });

    it('accepts 64-char hex private key', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        // 32 bytes of zeros in hex
        process.env['BT_STUDIO_PRIVATE_KEY'] = '0'.repeat(64);

        const config = loadConfig();

        expect(config.serverUrl).toBe('http://localhost:4100');
        expect(config.privateKey).toBeInstanceOf(Uint8Array);
        expect(config.privateKey.length).toBe(32);
        expect(config.privateKey.every((b) => b === 0)).toBe(true);
    });

    it('accepts base64url private key', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        // 32 zero bytes in base64url = AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
        // base64url without padding: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
        process.env['BT_STUDIO_PRIVATE_KEY'] = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

        const config = loadConfig();

        expect(config.privateKey.length).toBe(32);
        expect(config.privateKey.every((b) => b === 0)).toBe(true);
    });

    it('uses demo keypair when no private key provided', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        delete process.env['BT_STUDIO_PRIVATE_KEY'];

        const config = loadConfig();

        expect(config.privateKey.length).toBe(32);
    });

    it('uses default timeouts', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        delete process.env['BT_STUDIO_PRIVATE_KEY'];
        delete process.env['BT_STUDIO_EVAL_TIMEOUT_MS'];
        delete process.env['BT_STUDIO_COMPLETIONS_TIMEOUT_MS'];

        const config = loadConfig();

        expect(config.evalTimeoutMs).toBe(15000);
        expect(config.completionsTimeoutMs).toBe(5000);
    });

    it('respects custom timeout env vars', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        delete process.env['BT_STUDIO_PRIVATE_KEY'];
        process.env['BT_STUDIO_EVAL_TIMEOUT_MS'] = '30000';
        process.env['BT_STUDIO_COMPLETIONS_TIMEOUT_MS'] = '10000';

        const config = loadConfig();

        expect(config.evalTimeoutMs).toBe(30000);
        expect(config.completionsTimeoutMs).toBe(10000);
    });

    it('throws on invalid private key', () => {
        process.env['BT_STUDIO_URL'] = 'http://localhost:4100';
        process.env['BT_STUDIO_PRIVATE_KEY'] = 'not-a-valid-key';

        expect(() => loadConfig()).toThrow('BT_STUDIO_PRIVATE_KEY must be');
    });
});
