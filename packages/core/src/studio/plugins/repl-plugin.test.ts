import { describe, expect, it, vi } from 'vitest';
import nacl from 'tweetnacl';
import {
    bytesToJson,
    decodeEnvelope,
    decodeHeaderToken,
    deriveDirectionalKeys,
    encodeEnvelope,
    jsonToBytes,
    openSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
} from './repl-crypto';
import {
    getPropertyNamesDeep,
    isProbablyExpression,
    resolvePath,
    ReplPlugin,
    rewriteTopLevelDeclarations,
    toDisplayString,
} from './repl-plugin';
import type { PluginSender } from './repl-types';

// ---------------------------------------------------------------------------
// toDisplayString
// ---------------------------------------------------------------------------
describe('toDisplayString', () => {
    it('handles primitives', () => {
        expect(toDisplayString(null)).toBe('null');
        expect(toDisplayString(undefined)).toBe('undefined');
        expect(toDisplayString('hello')).toBe('hello');
        expect(toDisplayString(42)).toBe('42');
        expect(toDisplayString(true)).toBe('true');
        expect(toDisplayString(BigInt(99))).toBe('99');
    });

    it('handles functions', () => {
        expect(toDisplayString(function myFn() {})).toBe('[Function myFn]');
        expect(toDisplayString(() => {})).toBe('[Function anonymous]');
    });

    it('handles symbols', () => {
        expect(toDisplayString(Symbol('s'))).toBe('Symbol(s)');
    });

    it('JSON-stringifies plain objects', () => {
        const result = toDisplayString({ a: 1 });
        expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('handles bigint in objects via replacer', () => {
        const result = toDisplayString({ n: BigInt(1) });
        expect(result).toContain('"1"');
    });

    it('falls back for circular objects', () => {
        const obj: Record<string, unknown> = {};
        obj['self'] = obj;
        const result = toDisplayString(obj);
        expect(result).toContain('Object');
    });
});

// ---------------------------------------------------------------------------
// getPropertyNamesDeep
// ---------------------------------------------------------------------------
describe('getPropertyNamesDeep', () => {
    it('returns own properties', () => {
        const props = getPropertyNamesDeep({ x: 1, y: 2 });
        expect(props).toContain('x');
        expect(props).toContain('y');
    });

    it('walks up prototype chain', () => {
        class Base { baseMethod() {} }
        class Child extends Base { childMethod() {} }
        const props = getPropertyNamesDeep(new Child());
        expect(props).toContain('baseMethod');
        expect(props).toContain('childMethod');
    });

    it('handles null/undefined gracefully', () => {
        expect(getPropertyNamesDeep(null)).toEqual([]);
        expect(getPropertyNamesDeep(undefined)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------
describe('resolvePath', () => {
    it('resolves nested path', () => {
        const root = { a: { b: { c: 42 } } };
        expect(resolvePath(root, ['a', 'b', 'c'])).toBe(42);
    });

    it('returns undefined for missing segment', () => {
        expect(resolvePath({ a: 1 }, ['b', 'c'])).toBeUndefined();
    });

    it('skips empty segments', () => {
        expect(resolvePath({ a: { b: 1 } }, ['', 'a', '', 'b'])).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// isProbablyExpression
// ---------------------------------------------------------------------------
describe('isProbablyExpression', () => {
    it('detects simple expressions', () => {
        expect(isProbablyExpression('1 + 2')).toBe(true);
        expect(isProbablyExpression('Math.PI')).toBe(true);
        expect(isProbablyExpression('"hello"')).toBe(true);
    });

    it('rejects statement keywords', () => {
        expect(isProbablyExpression('let x = 1')).toBe(false);
        expect(isProbablyExpression('const y = 2')).toBe(false);
        expect(isProbablyExpression('if (true) {}')).toBe(false);
        expect(isProbablyExpression('function foo() {}')).toBe(false);
    });

    it('returns false for empty/whitespace', () => {
        expect(isProbablyExpression('')).toBe(false);
        expect(isProbablyExpression('   ')).toBe(false);
    });

    it('returns false for syntax errors', () => {
        expect(isProbablyExpression('(')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// rewriteTopLevelDeclarations
// ---------------------------------------------------------------------------
describe('rewriteTopLevelDeclarations', () => {
    it('rewrites let/const/var single declarations', () => {
        expect(rewriteTopLevelDeclarations('let x = 1')).toBe('globalThis.x = 1');
        expect(rewriteTopLevelDeclarations('const y = "hello"')).toBe('globalThis.y = "hello"');
        expect(rewriteTopLevelDeclarations('var z = true')).toBe('globalThis.z = true');
    });

    it('rewrites declaration without initializer', () => {
        expect(rewriteTopLevelDeclarations('let x')).toBe('globalThis.x = undefined');
    });

    it('preserves non-declaration lines', () => {
        expect(rewriteTopLevelDeclarations('console.log(1)')).toBe('console.log(1)');
        expect(rewriteTopLevelDeclarations('x = 5')).toBe('x = 5');
    });

    it('falls back to original for destructuring', () => {
        const code = 'const { a, b } = obj';
        expect(rewriteTopLevelDeclarations(code)).toBe(code);
    });

    it('handles multi-line code', () => {
        const result = rewriteTopLevelDeclarations('let a = 1\nconsole.log(a)');
        expect(result).toBe('globalThis.a = 1\nconsole.log(a)');
    });
});

// ---------------------------------------------------------------------------
// ReplPlugin — handshake
// ---------------------------------------------------------------------------

function makeUiKeyPair() {
    return nacl.box.keyPair();
}

function makePlugin(uiPublicKey: Uint8Array) {
    return new ReplPlugin({ serverPublicKey: uiPublicKey });
}

function makeTestSender() {
    const sent: { correlationId: string; payload: unknown }[] = [];
    const sender: PluginSender = {
        send: (correlationId, payload) => sent.push({ correlationId, payload }),
    };
    return { sender, sent };
}

describe('ReplPlugin handshake', () => {
    it('sends handshake payload on attach', () => {
        const uiKp = makeUiKeyPair();
        const plugin = makePlugin(uiKp.publicKey);
        const { sender, sent } = makeTestSender();

        plugin.attach(sender);

        expect(sent).toHaveLength(1);
        expect(sent[0]!.correlationId).toBe('handshake');
        const payload = sent[0]!.payload as { type: string; headerToken: string };
        expect(payload.type).toBe('handshake');
        expect(typeof payload.headerToken).toBe('string');
    });

    it('clears session keys on detach', () => {
        const uiKp = makeUiKeyPair();
        const plugin = makePlugin(uiKp.publicKey);
        const { sender } = makeTestSender();

        plugin.attach(sender);
        plugin.detach();

        // After detach, further handleInbound should silently drop
        const promise = plugin.handleInbound('x', 'payload');
        expect(promise).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// ReplPlugin — full eval/completions round-trip
// ---------------------------------------------------------------------------

/**
 * Sets up a UI-side session from the handshake token so we can encrypt
 * commands and decrypt responses exactly as the real UI would.
 */
function extractSessionKeysFromHandshake(
    handshakePayload: { type: string; headerToken: string },
    uiSecretKey: Uint8Array,
) {
    const { clientEphemeralPublicKey, nonce, ciphertext } = decodeHeaderToken(handshakePayload.headerToken);
    const seed = openSessionSeed({ nonce, box: ciphertext }, clientEphemeralPublicKey, uiSecretKey);
    return deriveDirectionalKeys(seed);
}

function uiEncrypt(payload: object, s2cKey: Uint8Array): string {
    const { nonce, box } = secretboxEncrypt(jsonToBytes(payload), s2cKey);
    return encodeEnvelope(nonce, box);
}

function uiDecrypt<T>(envelope: string, c2sKey: Uint8Array): T {
    const { nonce, ciphertext } = decodeEnvelope(envelope);
    return bytesToJson<T>(secretboxDecrypt(nonce, ciphertext, c2sKey));
}

describe('ReplPlugin eval round-trip', () => {
    async function setupPluginWithSession() {
        const uiKp = makeUiKeyPair();
        const plugin = makePlugin(uiKp.publicKey);
        const { sender, sent } = makeTestSender();

        plugin.attach(sender);

        // Extract session keys from handshake
        const handshake = sent[0]!.payload as { type: string; headerToken: string };
        const uiKeys = extractSessionKeysFromHandshake(handshake, uiKp.secretKey);

        return { plugin, sent, uiKeys };
    }

    it('evaluates an expression and returns result', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        const encrypted = uiEncrypt({ type: 'eval', code: '1 + 1' }, uiKeys.s2c);
        await plugin.handleInbound('corr-1', encrypted);

        expect(sent).toHaveLength(2); // handshake + result
        const result = uiDecrypt<{ type: string; text: string }>(sent[1]!.payload as string, uiKeys.c2s);
        expect(result.type).toBe('result');
        expect(result.text).toBe('2');
    });

    it('captures console output', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        const encrypted = uiEncrypt({ type: 'eval', code: 'console.log("hi"); 42' }, uiKeys.s2c);
        await plugin.handleInbound('corr-2', encrypted);

        const result = uiDecrypt<{ consoleOutput?: string[] }>(sent[1]!.payload as string, uiKeys.c2s);
        expect(result.consoleOutput).toEqual(['hi']);
    });

    it('returns error payload on exception', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        const encrypted = uiEncrypt({ type: 'eval', code: 'throw new Error("oops")' }, uiKeys.s2c);
        await plugin.handleInbound('corr-3', encrypted);

        const result = uiDecrypt<{ type: string; text: string }>(sent[1]!.payload as string, uiKeys.c2s);
        expect(result.type).toBe('error');
        expect(result.text).toContain('oops');
    });

    it('persists variables across evals via globalThis rewrite', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        const enc1 = uiEncrypt({ type: 'eval', code: 'let _testVar123 = 42' }, uiKeys.s2c);
        await plugin.handleInbound('corr-4a', enc1);

        const enc2 = uiEncrypt({ type: 'eval', code: '_testVar123' }, uiKeys.s2c);
        await plugin.handleInbound('corr-4b', enc2);

        const result = uiDecrypt<{ type: string; text: string }>(sent[2]!.payload as string, uiKeys.c2s);
        expect(result.type).toBe('result');
        expect(result.text).toBe('42');

        // Cleanup
        delete (globalThis as Record<string, unknown>)['_testVar123'];
    });

    it('returns completions for a prefix', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        const encrypted = uiEncrypt({ type: 'completions', prefix: 'Math.' }, uiKeys.s2c);
        await plugin.handleInbound('corr-5', encrypted);

        const result = uiDecrypt<{ type: string; completions: string[] }>(sent[1]!.payload as string, uiKeys.c2s);
        expect(result.type).toBe('completions');
        expect(result.completions).toContain('PI');
        expect(result.completions).toContain('abs');
    });

    it('silently drops messages before handshake', async () => {
        const uiKp = makeUiKeyPair();
        const plugin = makePlugin(uiKp.publicKey);

        // Do NOT attach — no session keys
        await expect(plugin.handleInbound('x', 'whatever')).resolves.toBeUndefined();
    });

    it('silently drops tampered payloads', async () => {
        const { plugin, sent, uiKeys } = await setupPluginWithSession();

        // Corrupt the envelope
        const enc = uiEncrypt({ type: 'eval', code: '1' }, uiKeys.s2c);
        const tampered = enc.slice(0, -4) + 'XXXX'; // corrupt last bytes

        await plugin.handleInbound('corr-bad', tampered);

        // No result should be sent (only the initial handshake)
        expect(sent).toHaveLength(1);
    });

    it('times out long-running evals', async () => {
        // Reduce timeout by mocking setTimeout is complex; instead verify the timeout
        // path is exercised via a fast-rejecting promise. The real 15s timeout is tested
        // implicitly — we verify the error payload shape instead.
        vi.useFakeTimers();

        const uiKp = makeUiKeyPair();
        const plugin = makePlugin(uiKp.publicKey);
        const { sender, sent } = makeTestSender();
        plugin.attach(sender);
        const handshake = sent[0]!.payload as { type: string; headerToken: string };
        const uiKeys = extractSessionKeysFromHandshake(handshake, uiKp.secretKey);

        const encrypted = uiEncrypt({ type: 'eval', code: 'await new Promise(() => {})' }, uiKeys.s2c);
        const evalPromise = plugin.handleInbound('corr-timeout', encrypted);

        vi.advanceTimersByTime(15_001);
        await evalPromise;

        const result = uiDecrypt<{ type: string; text: string }>(sent[1]!.payload as string, uiKeys.c2s);
        expect(result.type).toBe('error');
        expect(result.text).toContain('timed out');

        vi.useRealTimers();
    });
});
