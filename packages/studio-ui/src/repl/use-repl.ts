import { useState, useCallback } from 'react';
import nacl from 'tweetnacl';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { trpc } from '../trpc';

// ---- crypto helpers (browser-safe subset of Frostmod crypto.ts) ----

function base64urlEncode(bytes: Uint8Array): string {
    const bin = btoa(String.fromCharCode(...bytes));
    return bin.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(s: string): Uint8Array {
    const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : s.length % 4 === 1 ? '===' : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    return new Uint8Array(bin.split('').map((c) => c.charCodeAt(0)));
}

function jsonToBytes(obj: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(obj));
}

function bytesToJson<T = unknown>(bytes: Uint8Array): T {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function encodeEnvelope(nonce: Uint8Array, ciphertext: Uint8Array): string {
    const out = new Uint8Array(nonce.length + ciphertext.length);
    out.set(nonce, 0);
    out.set(ciphertext, nonce.length);
    return base64urlEncode(out);
}

function decodeEnvelope(packed: string): { nonce: Uint8Array; ciphertext: Uint8Array } {
    const bytes = base64urlDecode(packed);
    const nonce = bytes.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = bytes.slice(nacl.secretbox.nonceLength);
    return { nonce, ciphertext };
}

function deriveDirectionalKeys(seed: Uint8Array): { c2s: Uint8Array; s2c: Uint8Array } {
    const salt = new Uint8Array(0);
    const c2s = hkdf(sha256, seed, salt, new TextEncoder().encode('c2s'), 32);
    const s2c = hkdf(sha256, seed, salt, new TextEncoder().encode('s2c'), 32);
    return { c2s: new Uint8Array(c2s), s2c: new Uint8Array(s2c) };
}

// ---- demo keypair (deterministic, for out-of-the-box REPL experience) ----
// Must match DEMO_SERVER_KEYPAIR in packages/studio-plugins/src/repl-crypto.ts
// Seed: "bt-studio-demo-repl-key-v1------" as ASCII bytes
// NEVER use in production — this key is public knowledge.
const DEMO_PRIVATE_KEY = new Uint8Array([
    0x62, 0x74, 0x2d, 0x73, 0x74, 0x75, 0x64, 0x69,
    0x6f, 0x2d, 0x64, 0x65, 0x6d, 0x6f, 0x2d, 0x72,
    0x65, 0x70, 0x6c, 0x2d, 0x6b, 0x65, 0x79, 0x2d,
    0x76, 0x31, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d, 0x2d,
]);

// ---- localStorage key management ----

const LS_PRIVATE_KEY = 'repl-private-key';

export interface ReplKeyPair {
    publicKeyB64: string;
    privateKeyB64: string;
    secretKeyBytes: Uint8Array;
}

function keyPairFromSecret(sk: Uint8Array): ReplKeyPair {
    const kp = nacl.box.keyPair.fromSecretKey(sk);
    return {
        publicKeyB64: base64urlEncode(kp.publicKey),
        privateKeyB64: base64urlEncode(sk),
        secretKeyBytes: sk,
    };
}

export function loadStoredKeyPair(): ReplKeyPair | null {
    try {
        const stored = localStorage.getItem(LS_PRIVATE_KEY);
        if (!stored) return null;
        const sk = base64urlDecode(stored);
        return keyPairFromSecret(sk);
    } catch {
        return null;
    }
}

function loadDefaultKeyPair(): ReplKeyPair {
    const stored = loadStoredKeyPair();
    if (stored) return stored;
    const kp = keyPairFromSecret(DEMO_PRIVATE_KEY);
    localStorage.setItem(LS_PRIVATE_KEY, kp.privateKeyB64);
    return kp;
}

export function generateKeyPair(): ReplKeyPair {
    const sk = new Uint8Array(32);
    crypto.getRandomValues(sk);
    const kp = keyPairFromSecret(sk);
    localStorage.setItem(LS_PRIVATE_KEY, kp.privateKeyB64);
    return kp;
}

export function importPrivateKeyFromString(input: string): ReplKeyPair {
    const trimmed = input.trim();
    let sk: Uint8Array;
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64) {
        sk = new Uint8Array(trimmed.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    } else {
        sk = base64urlDecode(trimmed);
    }
    if (sk.length !== 32) throw new Error('Private key must be 32 bytes');
    const kp = keyPairFromSecret(sk);
    localStorage.setItem(LS_PRIVATE_KEY, kp.privateKeyB64);
    return kp;
}

// ---- payload types ----

export interface ReplResult {
    kind: 'result' | 'error';
    text: string;
    consoleOutput?: string[];
}

// ---- session key derivation from handshake ----

function openHandshake(headerToken: string, secretKey: Uint8Array): { c2s: Uint8Array; s2c: Uint8Array } {
    const bytes = base64urlDecode(headerToken);
    if (bytes.length < 1 + 32 + 24 + nacl.box.overheadLength) throw new Error('Header token too short');
    const ephPub = bytes.slice(1, 1 + 32);
    const nonce = bytes.slice(1 + 32, 1 + 32 + 24);
    const box = bytes.slice(1 + 32 + 24);
    const seed = nacl.box.open(box, nonce, ephPub, secretKey);
    if (!seed) throw new Error('Failed to decrypt handshake');
    return deriveDirectionalKeys(seed);
}

// ---- hook ----

export interface UseReplOptions {
    clientId: string | null;
    sessionId: string | null;
}

export interface UseReplReturn {
    /** Session established (handshake complete) */
    ready: boolean;
    keyPair: ReplKeyPair | null;
    generateKeyPair: () => ReplKeyPair;
    importPrivateKey: (input: string) => void;
    establishSession: (headerToken: string) => void;
    sendEval: (code: string) => Promise<ReplResult>;
    sendCompletions: (prefix: string, maxResults?: number) => Promise<string[]>;
}

export function useRepl({ clientId, sessionId }: UseReplOptions): UseReplReturn {
    const [keyPair, setKeyPair] = useState<ReplKeyPair | null>(() => loadDefaultKeyPair());
    const [sessionKeys, setSessionKeys] = useState<{ c2s: Uint8Array; s2c: Uint8Array } | null>(null);

    const handleGenerateKeyPair = useCallback((): ReplKeyPair => {
        const kp = generateKeyPair();
        setKeyPair(kp);
        setSessionKeys(null);
        return kp;
    }, []);

    const handleImportPrivateKey = useCallback((input: string) => {
        const kp = importPrivateKeyFromString(input);
        setKeyPair(kp);
        setSessionKeys(null);
    }, []);

    const establishSession = useCallback((headerToken: string) => {
        if (!keyPair) throw new Error('No keypair available');
        const keys = openHandshake(headerToken, keyPair.secretKeyBytes);
        setSessionKeys(keys);
    }, [keyPair]);

    const sendEval = useCallback(async (code: string): Promise<ReplResult> => {
        if (!clientId || !sessionId) throw new Error('No agent selected');

        if (!sessionKeys) {
            // No session keys yet — send plaintext eval for development/testing
            // In production the agent will reject this
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = await (trpc as any).repl.eval.mutate({ clientId, sessionId, code });
            return raw as ReplResult;
        }

        // Encrypt payload with s2c key (UI → agent direction)
        const plaintext = jsonToBytes({ type: 'eval', code });
        const nonce = new Uint8Array(nacl.secretbox.nonceLength);
        crypto.getRandomValues(nonce);
        const box = nacl.secretbox(plaintext, nonce, sessionKeys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await (trpc as any).repl.eval.mutate({ clientId, sessionId, encryptedPayload });

        // Decrypt response with c2s key (agent → UI direction)
        const { nonce: rNonce, ciphertext } = decodeEnvelope(raw as string);
        const decrypted = nacl.secretbox.open(ciphertext, rNonce, sessionKeys.c2s);
        if (!decrypted) throw new Error('Failed to decrypt eval response');
        return bytesToJson<ReplResult>(decrypted);
    }, [clientId, sessionId, sessionKeys]);

    const sendCompletions = useCallback(async (prefix: string, maxResults = 50): Promise<string[]> => {
        if (!clientId || !sessionId) return [];

        if (!sessionKeys) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = await (trpc as any).repl.completions.mutate({ clientId, sessionId, prefix, maxResults });
            return (raw as { completions: string[] }).completions;
        }

        const plaintext = jsonToBytes({ type: 'completions', prefix, maxResults });
        const nonce = new Uint8Array(nacl.secretbox.nonceLength);
        crypto.getRandomValues(nonce);
        const box = nacl.secretbox(plaintext, nonce, sessionKeys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = await (trpc as any).repl.completions.mutate({ clientId, sessionId, encryptedPayload });

        const { nonce: rNonce, ciphertext } = decodeEnvelope(raw as string);
        const decrypted = nacl.secretbox.open(ciphertext, rNonce, sessionKeys.c2s);
        if (!decrypted) throw new Error('Failed to decrypt completions response');
        return bytesToJson<{ completions: string[] }>(decrypted).completions;
    }, [clientId, sessionId, sessionKeys]);

    return {
        ready: sessionKeys !== null,
        keyPair,
        generateKeyPair: handleGenerateKeyPair,
        importPrivateKey: handleImportPrivateKey,
        establishSession,
        sendEval,
        sendCompletions,
    };
}
