/**
 * ReplClient — UI-side E2E crypto for the REPL.
 *
 * Encapsulates key management and per-message encryption/decryption so
 * that use-repl.ts and other consumers don't need to handle raw NaCl.
 *
 * Protocol (agent-initiated handshake):
 *   1. Agent generates ephemeral keypair + session seed.
 *   2. Agent seals session seed to UI's long-term public key → headerToken.
 *   3. Server relays headerToken to UI (blind relay).
 *   4. UI calls completeHandshake(headerToken) → derives c2s / s2c keys.
 *   5. UI encrypts requests with s2c key; agent decrypts with s2c key.
 *   6. Agent encrypts responses with c2s key; UI decrypts with c2s key.
 */
import { x25519 } from '@noble/curves/ed25519';
import {
    base64urlDecode,
    bytesToJson,
    decodeEnvelope,
    deriveDirectionalKeys,
    encodeEnvelope,
    jsonToBytes,
    openSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
    type DirectionalKeys,
} from './repl-crypto';

// ---------------------------------------------------------------------------
// Payload types mirrored from repl-types (avoid circular deps)
// ---------------------------------------------------------------------------

interface EvalResponsePayload {
    kind: 'result' | 'error';
    text: string;
    consoleOutput?: string[];
}

interface CompletionsResponsePayload {
    completions: string[];
}

// ---------------------------------------------------------------------------
// ReplClient
// ---------------------------------------------------------------------------

export class ReplClient {
    private readonly _secretKey: Uint8Array;
    private readonly _publicKey: Uint8Array;
    private _sessionKeys: DirectionalKeys | null = null;

    constructor(privateKey: Uint8Array) {
        if (privateKey.length !== 32) {
            throw new Error('Private key must be 32 bytes');
        }
        this._secretKey = privateKey;
        this._publicKey = x25519.getPublicKey(privateKey);
    }

    /** The UI's long-term NaCl box public key (32 bytes). */
    get publicKey(): Uint8Array {
        return this._publicKey;
    }

    /** True after a successful completeHandshake() call. */
    get isReady(): boolean {
        return this._sessionKeys !== null;
    }

    /**
     * Process the agent's headerToken (relayed by the server from repl.handshake.query).
     * Derives the shared c2s / s2c session keys.
     *
     * headerToken binary layout (base64url-encoded):
     *   [0]      version (1 byte)
     *   [1..32]  agent ephemeral public key (32 bytes)
     *   [33..56] nonce (24 bytes)
     *   [57..]   ciphertext (sessionSeed sealed to our public key)
     */
    completeHandshake(agentHeaderToken: string): void {
        const bytes = base64urlDecode(agentHeaderToken);
        if (bytes.length < 1 + 32 + 24 + 16) {
            throw new Error('Header token too short');
        }
        const ephPub = bytes.slice(1, 1 + 32);
        const nonce = bytes.slice(1 + 32, 1 + 32 + 24);
        const box = bytes.slice(1 + 32 + 24);
        let seed: Uint8Array;
        try {
            seed = openSessionSeed({ nonce, box }, ephPub, this._secretKey);
        } catch {
            throw new Error('Failed to decrypt handshake');
        }
        this._sessionKeys = deriveDirectionalKeys(seed);
    }

    /** Reset session keys (e.g. on agent disconnect). */
    resetSession(): void {
        this._sessionKeys = null;
    }

    // -------------------------------------------------------------------------
    // Encrypt outbound requests (UI → agent, s2c key)
    // -------------------------------------------------------------------------

    encryptEval(code: string): string {
        const keys = this._requireKeys();
        const { nonce, box } = secretboxEncrypt(jsonToBytes({ type: 'eval', code }), keys.s2c);
        return encodeEnvelope(nonce, box);
    }

    encryptCompletions(prefix: string, maxResults?: number): string {
        const keys = this._requireKeys();
        const { nonce, box } = secretboxEncrypt(
            jsonToBytes({ type: 'completions', prefix, ...(maxResults !== undefined ? { maxResults } : {}) }),
            keys.s2c,
        );
        return encodeEnvelope(nonce, box);
    }

    // -------------------------------------------------------------------------
    // Decrypt inbound responses (agent → UI, c2s key)
    // -------------------------------------------------------------------------

    decryptEvalResponse(encrypted: string): EvalResponsePayload {
        const keys = this._requireKeys();
        const { nonce, ciphertext } = decodeEnvelope(encrypted);
        const plaintext = secretboxDecrypt(nonce, ciphertext, keys.c2s);
        return bytesToJson<EvalResponsePayload>(plaintext);
    }

    decryptCompletionsResponse(encrypted: string): CompletionsResponsePayload {
        const keys = this._requireKeys();
        const { nonce, ciphertext } = decodeEnvelope(encrypted);
        const plaintext = secretboxDecrypt(nonce, ciphertext, keys.c2s);
        return bytesToJson<CompletionsResponsePayload>(plaintext);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    private _requireKeys(): DirectionalKeys {
        if (!this._sessionKeys) throw new Error('ReplClient: handshake not complete');
        return this._sessionKeys;
    }
}
