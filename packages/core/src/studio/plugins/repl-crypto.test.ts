import { describe, expect, it } from 'vitest';
import {
    base64urlDecode,
    base64urlEncode,
    bytesToJson,
    getRandomBytes,
    jsonToBytes,
} from './repl-crypto';

describe('base64url', () => {
    it('round-trips arbitrary bytes', () => {
        const bytes = getRandomBytes(64);
        expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
    });

    it('produces no padding characters', () => {
        for (let len = 1; len <= 10; len++) {
            const encoded = base64urlEncode(getRandomBytes(len));
            expect(encoded).not.toContain('=');
            expect(encoded).not.toContain('+');
            expect(encoded).not.toContain('/');
        }
    });
});

describe('getRandomBytes', () => {
    it('returns the requested length', () => {
        expect(getRandomBytes(16)).toHaveLength(16);
        expect(getRandomBytes(32)).toHaveLength(32);
    });

    it('returns different values each call', () => {
        const a = getRandomBytes(16);
        const b = getRandomBytes(16);
        expect(a).not.toEqual(b);
    });
});

describe('jsonToBytes / bytesToJson', () => {
    it('round-trips a plain object', () => {
        const obj = { type: 'eval', code: 'const x = 1' };
        expect(bytesToJson(jsonToBytes(obj))).toEqual(obj);
    });
});
