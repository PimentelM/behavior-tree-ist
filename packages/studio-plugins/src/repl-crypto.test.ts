import { describe, expect, it } from 'vitest';
import {
    base64urlDecode,
    base64urlEncode,
    bytesToJson,
    decodeEnvelope,
    decodeHeaderToken,
    deriveDirectionalKeys,
    encodeEnvelope,
    encodeHeaderToken,
    generateEphemeralKeyPair,
    getRandomBytes,
    jsonToBytes,
    openSessionSeed,
    sealSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
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

    it('throws on invalid base64url string (length % 4 === 1)', () => {
        // A base64url string with length % 4 === 1 is inherently invalid
        expect(() => base64urlDecode('a')).toThrow('Invalid base64url string');
        expect(() => base64urlDecode('aaaaa')).toThrow('Invalid base64url string');
    });

    it('round-trips empty array', () => {
        const empty = new Uint8Array(0);
        expect(base64urlDecode(base64urlEncode(empty))).toEqual(empty);
    });

    it('round-trips 8192-byte payload', () => {
        const bytes = getRandomBytes(8192);
        expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
    });

    it('round-trips 100KB payload', () => {
        // Use fill+map to avoid getRandomValues 65536-byte quota limit
        const bytes = new Uint8Array(100 * 1024).map((_, i) => i % 256);
        expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
    });

    it('round-trips all 256 single-byte values', () => {
        for (let i = 0; i < 256; i++) {
            const b = new Uint8Array([i]);
            expect(base64urlDecode(base64urlEncode(b))).toEqual(b);
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

describe('generateEphemeralKeyPair', () => {
    it('returns 32-byte keys', () => {
        const kp = generateEphemeralKeyPair();
        expect(kp.publicKey).toHaveLength(32);
        expect(kp.secretKey).toHaveLength(32);
    });

    it('produces different keypairs each call', () => {
        const a = generateEphemeralKeyPair();
        const b = generateEphemeralKeyPair();
        expect(a.publicKey).not.toEqual(b.publicKey);
    });
});

describe('session seed seal / open', () => {
    it('round-trips a session seed with a valid keypair', () => {
        const agentKp = generateEphemeralKeyPair();
        const uiKp = generateEphemeralKeyPair();

        const seed = getRandomBytes(32);
        const { nonce, box } = sealSessionSeed(seed, uiKp.publicKey, agentKp.secretKey);
        const recovered = openSessionSeed({ nonce, box }, agentKp.publicKey, uiKp.secretKey);

        expect(recovered).toEqual(seed);
    });

    it('throws on tampered box', () => {
        const agentKp = generateEphemeralKeyPair();
        const uiKp = generateEphemeralKeyPair();
        const seed = getRandomBytes(32);
        const { nonce, box } = sealSessionSeed(seed, uiKp.publicKey, agentKp.secretKey);
        box[0] = (box[0] as number) ^ 0xff;

        expect(() => openSessionSeed({ nonce, box }, agentKp.publicKey, uiKp.secretKey)).toThrow('Invalid header token');
    });
});

describe('deriveDirectionalKeys', () => {
    it('derives deterministic 32-byte keys', () => {
        const seed = getRandomBytes(32);
        const keys1 = deriveDirectionalKeys(seed);
        const keys2 = deriveDirectionalKeys(seed);

        expect(keys1.c2s).toHaveLength(32);
        expect(keys1.s2c).toHaveLength(32);
        expect(keys1.c2s).toEqual(keys2.c2s);
        expect(keys1.s2c).toEqual(keys2.s2c);
    });

    it('c2s and s2c are distinct', () => {
        const keys = deriveDirectionalKeys(getRandomBytes(32));
        expect(keys.c2s).not.toEqual(keys.s2c);
    });

    it('different seeds produce different keys', () => {
        const a = deriveDirectionalKeys(getRandomBytes(32));
        const b = deriveDirectionalKeys(getRandomBytes(32));
        expect(a.c2s).not.toEqual(b.c2s);
    });
});

describe('secretbox encrypt / decrypt', () => {
    it('round-trips plaintext', () => {
        const key = getRandomBytes(32);
        const plain = new Uint8Array([1, 2, 3, 4]);
        const { nonce, box } = secretboxEncrypt(plain, key);
        expect(secretboxDecrypt(nonce, box, key)).toEqual(plain);
    });

    it('round-trips empty plaintext', () => {
        const key = getRandomBytes(32);
        const plain = new Uint8Array(0);
        const { nonce, box } = secretboxEncrypt(plain, key);
        expect(secretboxDecrypt(nonce, box, key)).toEqual(plain);
    });

    it('throws on tampered ciphertext', () => {
        const key = getRandomBytes(32);
        const { nonce, box } = secretboxEncrypt(new Uint8Array([1, 2, 3]), key);
        box[0] = (box[0] as number) ^ 0xff;
        expect(() => secretboxDecrypt(nonce, box, key)).toThrow('Decryption failed');
    });

    it('throws on wrong 32-byte key', () => {
        const key = getRandomBytes(32);
        const wrongKey = getRandomBytes(32);
        const { nonce, box } = secretboxEncrypt(new Uint8Array([1, 2, 3]), key);
        expect(() => secretboxDecrypt(nonce, box, wrongKey)).toThrow('Decryption failed');
    });

    it('throws on wrong nonce with correct key', () => {
        const key = getRandomBytes(32);
        const { box } = secretboxEncrypt(new Uint8Array([1, 2, 3]), key);
        const wrongNonce = getRandomBytes(24);
        expect(() => secretboxDecrypt(wrongNonce, box, key)).toThrow('Decryption failed');
    });

    it('throws on wrong key length', () => {
        expect(() => secretboxEncrypt(new Uint8Array([1]), getRandomBytes(16))).toThrow();
    });
});

describe('envelope encode / decode', () => {
    it('round-trips nonce + ciphertext', () => {
        const nonce = getRandomBytes(24);
        const box = getRandomBytes(16 + 10);
        const encoded = encodeEnvelope(nonce, box);
        const { nonce: n2, ciphertext: c2 } = decodeEnvelope(encoded);
        expect(n2).toEqual(nonce);
        expect(c2).toEqual(box);
    });

    it('throws on too-short envelope', () => {
        expect(() => decodeEnvelope(base64urlEncode(new Uint8Array(5)))).toThrow('Envelope too short');
    });
});

describe('headerToken encode / decode', () => {
    it('round-trips all fields', () => {
        const kp = generateEphemeralKeyPair();
        const nonce = getRandomBytes(24);
        const ciphertext = getRandomBytes(48);

        const token = encodeHeaderToken({
            version: 1,
            clientEphemeralPublicKey: kp.publicKey,
            nonce,
            ciphertext,
        });
        const fields = decodeHeaderToken(token);

        expect(fields.version).toBe(1);
        expect(fields.clientEphemeralPublicKey).toEqual(kp.publicKey);
        expect(fields.nonce).toEqual(nonce);
        expect(fields.ciphertext).toEqual(ciphertext);
    });

    it('throws on too-short token', () => {
        expect(() => decodeHeaderToken(base64urlEncode(new Uint8Array(10)))).toThrow('Token too short');
    });

    it('throws on wrong pubkey length', () => {
        expect(() =>
            encodeHeaderToken({
                version: 1,
                clientEphemeralPublicKey: getRandomBytes(16),
                nonce: getRandomBytes(24),
                ciphertext: getRandomBytes(48),
            }),
        ).toThrow('Invalid c_pub len');
    });

    it('throws on wrong nonce length', () => {
        expect(() =>
            encodeHeaderToken({
                version: 1,
                clientEphemeralPublicKey: getRandomBytes(32),
                nonce: getRandomBytes(12),
                ciphertext: getRandomBytes(48),
            }),
        ).toThrow('Invalid nonce len');
    });
});

describe('jsonToBytes / bytesToJson', () => {
    it('round-trips a plain object', () => {
        const obj = { type: 'eval', code: 'const x = 1' };
        expect(bytesToJson(jsonToBytes(obj))).toEqual(obj);
    });
});

describe('full pipeline large payload', () => {
    it('seal → derive → encrypt → envelope → decrypt with 100KB plaintext', () => {
        const agentKp = generateEphemeralKeyPair();
        const uiKp = generateEphemeralKeyPair();
        const sessionSeed = getRandomBytes(32);

        const { nonce, box } = sealSessionSeed(sessionSeed, uiKp.publicKey, agentKp.secretKey);
        const recoveredSeed = openSessionSeed({ nonce, box }, agentKp.publicKey, uiKp.secretKey);
        const keys = deriveDirectionalKeys(recoveredSeed);

        // Use fill+map to avoid getRandomValues 65536-byte quota limit
        const plaintext = new Uint8Array(100 * 1024).map((_, i) => i % 256);
        const encrypted = secretboxEncrypt(plaintext, keys.c2s);
        const envelope = encodeEnvelope(encrypted.nonce, encrypted.box);

        const { nonce: envNonce, ciphertext } = decodeEnvelope(envelope);
        const decrypted = secretboxDecrypt(envNonce, ciphertext, keys.c2s);

        expect(decrypted).toEqual(plaintext);
    });
});

describe('full handshake integration', () => {
    it('agent and UI derive identical session keys', () => {
        const uiKeyPair = generateEphemeralKeyPair();
        const agentEphemeral = generateEphemeralKeyPair();
        const sessionSeed = getRandomBytes(32);

        const { nonce, box } = sealSessionSeed(sessionSeed, uiKeyPair.publicKey, agentEphemeral.secretKey);
        const headerToken = encodeHeaderToken({
            version: 1,
            clientEphemeralPublicKey: agentEphemeral.publicKey,
            nonce,
            ciphertext: box,
        });

        const { clientEphemeralPublicKey, nonce: hn, ciphertext: hc } = decodeHeaderToken(headerToken);
        const recoveredSeed = openSessionSeed(
            { nonce: hn, box: hc },
            clientEphemeralPublicKey,
            uiKeyPair.secretKey,
        );

        expect(recoveredSeed).toEqual(sessionSeed);

        const agentKeys = deriveDirectionalKeys(sessionSeed);
        const uiKeys = deriveDirectionalKeys(recoveredSeed);
        expect(agentKeys.c2s).toEqual(uiKeys.c2s);
        expect(agentKeys.s2c).toEqual(uiKeys.s2c);
    });
});
