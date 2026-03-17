/**
 * NaCl crypto layer for the REPL plugin.
 * Ported from references/Frostmod/packages/common/src/security/crypto.ts.
 */
import nacl from 'tweetnacl';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';

// ---------------------------------------------------------------------------
// Base64url helpers (no padding)
// ---------------------------------------------------------------------------

export function base64urlEncode(bytes: Uint8Array): string {
    const bin = Buffer.from(bytes).toString('base64');
    return bin.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64urlDecode(s: string): Uint8Array {
    if (s.length % 4 === 1) throw new Error('Invalid base64url string');
    const pad =
        s.length % 4 === 2 ? '==' :
        s.length % 4 === 3 ? '=' :
        '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------------
// Header token (version | ephemeral_pub | nonce | ciphertext)
// ---------------------------------------------------------------------------

export type HeaderTokenFields = {
    version: number;                    // 1 byte (0–255)
    clientEphemeralPublicKey: Uint8Array; // 32 bytes
    nonce: Uint8Array;                  // 24 bytes
    ciphertext: Uint8Array;             // sealed sessionSeed
};

export function encodeHeaderToken(fields: HeaderTokenFields): string {
    const { version, clientEphemeralPublicKey, nonce, ciphertext } = fields;
    if (clientEphemeralPublicKey.length !== nacl.box.publicKeyLength) {
        throw new Error('Invalid c_pub len');
    }
    if (nonce.length !== nacl.box.nonceLength) throw new Error('Invalid nonce len');

    const out = new Uint8Array(
        1 + clientEphemeralPublicKey.length + nonce.length + ciphertext.length,
    );
    out[0] = version & 0xff;
    out.set(clientEphemeralPublicKey, 1);
    out.set(nonce, 1 + clientEphemeralPublicKey.length);
    out.set(ciphertext, 1 + clientEphemeralPublicKey.length + nonce.length);
    return base64urlEncode(out);
}

export function decodeHeaderToken(token: string): HeaderTokenFields {
    const bytes = base64urlDecode(token);
    if (bytes.length < 1 + 32 + 24 + nacl.box.overheadLength) {
        throw new Error('Token too short');
    }
    const version = bytes[0] as number;
    const cPub = bytes.slice(1, 1 + 32);
    const nonce = bytes.slice(1 + 32, 1 + 32 + 24);
    const ciphertext = bytes.slice(1 + 32 + 24);
    return { version, clientEphemeralPublicKey: cPub, nonce, ciphertext };
}

// ---------------------------------------------------------------------------
// Cross-runtime CSPRNG
// ---------------------------------------------------------------------------

export function getRandomBytes(length: number): Uint8Array {
    const g = (typeof globalThis !== 'undefined') ? (globalThis as Record<string, unknown>) : {};
    const webCrypto = g['crypto'] as { getRandomValues?: (buf: Uint8Array) => Uint8Array } | undefined;
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
        const out = new Uint8Array(length);
        webCrypto.getRandomValues(out);
        return out;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCrypto = typeof require !== 'undefined' ? require('crypto') as { randomBytes: (n: number) => Buffer } : null;
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
            return new Uint8Array(nodeCrypto.randomBytes(length));
        }
    } catch {
        // ignore
    }
    throw new Error('No CSPRNG available: no crypto.getRandomValues or node:crypto found');
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export function generateEphemeralKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array } {
    const sk = getRandomBytes(32);
    const kp = nacl.box.keyPair.fromSecretKey(sk);
    return { publicKey: kp.publicKey, secretKey: kp.secretKey };
}

// ---------------------------------------------------------------------------
// Session seed sealing / opening (NaCl box)
// ---------------------------------------------------------------------------

export function sealSessionSeed(
    sessionSeed: Uint8Array,
    uiPublicKey: Uint8Array,
    clientEphemeralSecretKey: Uint8Array,
): { nonce: Uint8Array; box: Uint8Array } {
    const nonce = getRandomBytes(nacl.box.nonceLength);
    const ciphertext = nacl.box(sessionSeed, nonce, uiPublicKey, clientEphemeralSecretKey);
    return { nonce, box: ciphertext };
}

export function openSessionSeed(
    boxed: { nonce: Uint8Array; box: Uint8Array },
    clientEphemeralPublicKey: Uint8Array,
    uiSecretKey: Uint8Array,
): Uint8Array {
    const opened = nacl.box.open(boxed.box, boxed.nonce, clientEphemeralPublicKey, uiSecretKey);
    if (!opened) throw new Error('Invalid header token');
    return opened;
}

// ---------------------------------------------------------------------------
// Directional key derivation (HKDF-SHA256)
// ---------------------------------------------------------------------------

export type DirectionalKeys = { c2s: Uint8Array; s2c: Uint8Array };

/**
 * Derives two 32-byte symmetric keys from a shared session seed.
 *   c2s — client (agent) → server (UI) direction
 *   s2c — server (UI) → client (agent) direction
 */
export function deriveDirectionalKeys(sessionSeed: Uint8Array): DirectionalKeys {
    const salt = new Uint8Array(0);
    const c2s = hkdf(sha256, sessionSeed, salt, Buffer.from('c2s'), 32);
    const s2c = hkdf(sha256, sessionSeed, salt, Buffer.from('s2c'), 32);
    return { c2s: new Uint8Array(c2s), s2c: new Uint8Array(s2c) };
}

// ---------------------------------------------------------------------------
// Secretbox (symmetric encryption)
// ---------------------------------------------------------------------------

export function secretboxEncrypt(
    plaintext: Uint8Array,
    key: Uint8Array,
): { nonce: Uint8Array; box: Uint8Array } {
    if (key.length !== nacl.secretbox.keyLength) throw new Error('Invalid secretbox key length');
    const nonce = getRandomBytes(nacl.secretbox.nonceLength);
    const box = nacl.secretbox(plaintext, nonce, key);
    return { nonce, box };
}

export function secretboxDecrypt(nonce: Uint8Array, box: Uint8Array, key: Uint8Array): Uint8Array {
    if (key.length !== nacl.secretbox.keyLength) throw new Error('Invalid secretbox key length');
    const opened = nacl.secretbox.open(box, nonce, key);
    if (!opened) throw new Error('Decryption failed');
    return opened;
}

// ---------------------------------------------------------------------------
// Envelope (nonce || ciphertext, base64url-encoded)
// ---------------------------------------------------------------------------

export function encodeEnvelope(nonce: Uint8Array, ciphertext: Uint8Array): string {
    const out = new Uint8Array(nonce.length + ciphertext.length);
    out.set(nonce, 0);
    out.set(ciphertext, nonce.length);
    return base64urlEncode(out);
}

export function decodeEnvelope(packed: string): { nonce: Uint8Array; ciphertext: Uint8Array } {
    const bytes = base64urlDecode(packed);
    if (bytes.length < nacl.secretbox.nonceLength + nacl.secretbox.overheadLength) {
        throw new Error('Envelope too short');
    }
    const nonce = bytes.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = bytes.slice(nacl.secretbox.nonceLength);
    return { nonce, ciphertext };
}

// ---------------------------------------------------------------------------
// JSON ↔ bytes helpers
// ---------------------------------------------------------------------------

export function jsonToBytes(obj: unknown): Uint8Array {
    return new Uint8Array(Buffer.from(JSON.stringify(obj), 'utf8'));
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function bytesToJson<T = unknown>(bytes: Uint8Array): T {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
}

// ---------------------------------------------------------------------------
// Demo keypair — predictable keypair for development/demo mode
// ---------------------------------------------------------------------------

/**
 * A fixed NaCl box keypair for the UI in demo/development mode.
 * The agent-side ReplPlugin seals the session seed to this public key;
 * the UI-side ReplTerminal holds the matching private key to open it.
 * Works out of the box without key configuration.
 *
 * NEVER use this in production — these keys are public.
 */
export const DEMO_UI_KEYPAIR: { publicKey: Uint8Array; secretKey: Uint8Array } = (() => {
    // Fixed 32-byte seed: "bt-studio-demo-repl-key-v1------"
    const seed = new Uint8Array([
        0x62, 0x74, 0x2d, 0x73, 0x74, 0x75, 0x64, 0x69,
        0x6f, 0x2d, 0x64, 0x65, 0x6d, 0x6f, 0x2d, 0x72,
        0x65, 0x70, 0x6c, 0x2d, 0x6b, 0x65, 0x79, 0x2d,
        0x76, 0x31, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d,
    ]);
    const kp = nacl.box.keyPair.fromSecretKey(seed);
    return { publicKey: kp.publicKey, secretKey: kp.secretKey };
})();
