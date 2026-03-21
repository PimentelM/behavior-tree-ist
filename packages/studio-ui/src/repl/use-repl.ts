import { useState, useCallback, useEffect, useRef } from 'react';
import { x25519 } from '@noble/curves/ed25519';
import { xsalsa20poly1305, hsalsa } from '@noble/ciphers/salsa';
import { u32 } from '@noble/ciphers/utils';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { trpc } from '../trpc';

/** Salsa20 "expand 32-byte k" sigma constant. */
const SIGMA = new Uint32Array([0x61707865, 0x3320646e, 0x79622d32, 0x6b206574]);

// ---- NaCl constants ----

const SECRETBOX_NONCE_BYTES = 24;
const BOX_OVERHEAD_BYTES = 16;

// ---- crypto helpers (browser-safe, pure-JS noble crypto) ----

function base64urlEncode(bytes: Uint8Array): string {
    const CHUNK = 8192;
    let bin = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(s: string): Uint8Array {
    if (s.length % 4 === 1) throw new Error('Invalid base64url string');
    const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function jsonToBytes(obj: unknown): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(obj));
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function bytesToJson<T = unknown>(bytes: Uint8Array): T {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function encodeEnvelope(nonce: Uint8Array, ciphertext: Uint8Array): string {
    const out = new Uint8Array(nonce.length + ciphertext.length);
    out.set(nonce, 0);
    out.set(ciphertext, nonce.length);
    return base64urlEncode(out);
}

export function decodeEnvelope(packed: string): { nonce: Uint8Array; ciphertext: Uint8Array } {
    const bytes = base64urlDecode(packed);
    if (bytes.length < SECRETBOX_NONCE_BYTES + 16) throw new Error('Envelope too short');
    const nonce = bytes.slice(0, SECRETBOX_NONCE_BYTES);
    const ciphertext = bytes.slice(SECRETBOX_NONCE_BYTES);
    return { nonce, ciphertext };
}

function deriveDirectionalKeys(seed: Uint8Array): { c2s: Uint8Array; s2c: Uint8Array } {
    const salt = new Uint8Array(0);
    const c2s = hkdf(sha256, seed, salt, new TextEncoder().encode('c2s'), 32);
    const s2c = hkdf(sha256, seed, salt, new TextEncoder().encode('s2c'), 32);
    return { c2s: new Uint8Array(c2s), s2c: new Uint8Array(s2c) };
}

function secretboxEncrypt(plaintext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array {
    return xsalsa20poly1305(key, nonce).encrypt(plaintext);
}

function secretboxDecrypt(ciphertext: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null {
    try {
        return xsalsa20poly1305(key, nonce).decrypt(ciphertext);
    } catch {
        return null;
    }
}

function boxBeforeNm(theirPublicKey: Uint8Array, mySecretKey: Uint8Array): Uint8Array {
    const dh = x25519.getSharedSecret(mySecretKey, theirPublicKey);
    // Copy to fresh aligned buffer so u32 view is safe
    const aligned = new Uint8Array(32);
    aligned.set(dh);
    const outU32 = new Uint32Array(8);
    hsalsa(SIGMA, u32(aligned), new Uint32Array(4), outU32);
    return new Uint8Array(outU32.buffer);
}

function boxOpen(data: Uint8Array, nonce: Uint8Array, theirPub: Uint8Array, myPriv: Uint8Array): Uint8Array | null {
    try {
        return xsalsa20poly1305(boxBeforeNm(theirPub, myPriv), nonce).decrypt(data);
    } catch {
        return null;
    }
}

// ---- demo keypair (deterministic, for out-of-the-box REPL experience) ----
// Must match DEMO_UI_KEYPAIR in packages/studio-plugins/src/repl-crypto.ts
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
    const pk = x25519.getPublicKey(sk);
    return {
        publicKeyB64: base64urlEncode(pk),
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
        sk = new Uint8Array((trimmed.match(/.{2}/g) as RegExpMatchArray).map((b) => parseInt(b, 16)));
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
    if (bytes.length < 1 + 32 + 24 + BOX_OVERHEAD_BYTES) throw new Error('Header token too short');
    const ephPub = bytes.slice(1, 1 + 32);
    const nonce = bytes.slice(1 + 32, 1 + 32 + 24);
    const box = bytes.slice(1 + 32 + 24);
    const seed = boxOpen(box, nonce, ephPub, secretKey);
    if (!seed) throw new Error('Failed to decrypt handshake');
    return deriveDirectionalKeys(seed);
}

// ---- hook ----

export interface UseReplOptions {
    clientId: string | null;
    sessionId: string | null;
}

export type HandshakeStatus = 'idle' | 'connecting' | 'established' | { error: string };

export interface UseReplReturn {
    /** Session established (handshake complete) */
    ready: boolean;
    keyPair: ReplKeyPair | null;
    handshakeStatus: HandshakeStatus;
    sessionKeys: { c2s: Uint8Array; s2c: Uint8Array } | null;
    /** Encrypted payloads sent by this UI instance via sendEval (for self-eval filtering in monitor). */
    sentEncryptedPayloads: Set<string>;
    generateKeyPair: () => ReplKeyPair;
    importPrivateKey: (input: string) => void;
    establishSession: (headerToken: string) => void;
    sendEval: (code: string) => Promise<ReplResult>;
    sendCompletions: (prefix: string, maxResults?: number) => Promise<string[]>;
}

export function useRepl({ clientId, sessionId }: UseReplOptions): UseReplReturn {
    const [keyPair, setKeyPair] = useState<ReplKeyPair | null>(() => loadDefaultKeyPair());
    const [sessionKeys, setSessionKeys] = useState<{ c2s: Uint8Array; s2c: Uint8Array } | null>(null);
    const [handshakeStatus, setHandshakeStatus] = useState<HandshakeStatus>('idle');
    const sentEncryptedPayloadsRef = useRef(new Set<string>());

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

    // Automatically initiate handshake when agent is connected.
    // Polls until the agent has sent its headerToken (repl.handshake.query).
    useEffect(() => {
        if (!clientId || !sessionId || sessionKeys) return;
        if (!keyPair) return;
        let cancelled = false;
        setHandshakeStatus('connecting');
        const initSession = async () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                const res = await (trpc as any).repl.handshake.query({ clientId, sessionId });
                if (cancelled) return;
                const { headerToken } = res as { headerToken: string };
                // openHandshake can throw on decrypt failure — treat as definitive
                let keys: { c2s: Uint8Array; s2c: Uint8Array };
                try {
                    keys = openHandshake(headerToken, keyPair.secretKeyBytes);
                } catch (decryptErr) {
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- cancelled is a closure variable; TS narrowing treats it as false here (checked above), but guard is retained for safety if code is refactored to add async boundaries
                    if (!cancelled) {
                        setHandshakeStatus({ error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr) });
                    }
                    return;
                }
                setSessionKeys(keys);
                setHandshakeStatus('established');
            } catch {
                // Agent may not have connected yet — retry after a short delay
                if (!cancelled) {
                    setTimeout(() => { if (!cancelled) void initSession(); }, 500);
                }
            }
        };
        void initSession();
        return () => { cancelled = true; };
    }, [clientId, sessionId, keyPair, sessionKeys]);

    const sendEval = useCallback(async (code: string): Promise<ReplResult> => {
        if (!clientId || !sessionId) throw new Error('No agent selected');
        if (!sessionKeys) throw new Error('REPL session not ready — handshake in progress');

        // Encrypt payload with s2c key (UI → agent direction)
        const plaintext = jsonToBytes({ type: 'eval', code });
        const nonce = new Uint8Array(SECRETBOX_NONCE_BYTES);
        crypto.getRandomValues(nonce);
        const box = secretboxEncrypt(plaintext, nonce, sessionKeys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        // Track this payload so the monitor can filter out self-initiated evals.
        sentEncryptedPayloadsRef.current.add(encryptedPayload);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const response = await (trpc as any).repl.eval.mutate({ clientId, sessionId, encryptedPayload });

        // Decrypt response with c2s key (agent → UI direction)
        const { nonce: rNonce, ciphertext } = decodeEnvelope((response as { encryptedPayload: string }).encryptedPayload);
        const decrypted = secretboxDecrypt(ciphertext, rNonce, sessionKeys.c2s);
        if (!decrypted) throw new Error('Failed to decrypt eval response');
        return bytesToJson<ReplResult>(decrypted);
    }, [clientId, sessionId, sessionKeys]);

    const sendCompletions = useCallback(async (prefix: string, maxResults = 50): Promise<string[]> => {
        if (!clientId || !sessionId) return [];
        if (!sessionKeys) return [];

        const plaintext = jsonToBytes({ type: 'completions', prefix, maxResults });
        const nonce = new Uint8Array(SECRETBOX_NONCE_BYTES);
        crypto.getRandomValues(nonce);
        const box = secretboxEncrypt(plaintext, nonce, sessionKeys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const response = await (trpc as any).repl.completions.mutate({ clientId, sessionId, encryptedPayload });

        const { nonce: rNonce, ciphertext } = decodeEnvelope((response as { encryptedPayload: string }).encryptedPayload);
        const decrypted = secretboxDecrypt(ciphertext, rNonce, sessionKeys.c2s);
        if (!decrypted) throw new Error('Failed to decrypt completions response');
        return bytesToJson<{ completions: string[] }>(decrypted).completions;
    }, [clientId, sessionId, sessionKeys]);

    return {
        ready: sessionKeys !== null,
        keyPair,
        handshakeStatus,
        sessionKeys,
        sentEncryptedPayloads: sentEncryptedPayloadsRef.current,
        generateKeyPair: handleGenerateKeyPair,
        importPrivateKey: handleImportPrivateKey,
        establishSession,
        sendEval,
        sendCompletions,
    };
}
