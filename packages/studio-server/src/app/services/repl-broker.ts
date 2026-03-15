import { v4 as uuidv4 } from 'uuid';
import {
    type DirectionalKeys,
    bytesToJson,
    decodeEnvelope,
    decodeHeaderToken,
    deriveDirectionalKeys,
    encodeEnvelope,
    jsonToBytes,
    openSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
} from '@bt-studio/studio-plugins';
import { createLogger } from '../../infra/logging';
import { type CommandSenderInterface } from '../interfaces';

const PLUGIN_MESSAGE_T = 7;
const REPL_PLUGIN_ID = 'repl';
const DEFAULT_EVAL_TIMEOUT_MS = 15_000;
const DEFAULT_COMPLETIONS_TIMEOUT_MS = 5_000;

type PendingEntry = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
};

export interface ReplEvalResult {
    kind: 'result' | 'error';
    text: string;
    consoleOutput?: string[];
}

export interface ReplCompletionsResult {
    completions: string[];
}

export interface ReplBrokerInterface {
    sendEval(connectionId: string, code: string, timeoutMs?: number): Promise<ReplEvalResult>;
    sendCompletions(connectionId: string, prefix: string, maxResults?: number, timeoutMs?: number): Promise<ReplCompletionsResult>;
    handleAgentMessage(connectionId: string, correlationId: string, payload: unknown): void;
    removeConnection(connectionId: string): void;
    shutdown(): void;
}

export interface ReplBrokerConfig {
    commandSender: CommandSenderInterface;
    serverSecretKey: Uint8Array;
}

export class ReplBroker implements ReplBrokerInterface {
    private readonly logger = createLogger('repl-broker');
    private readonly pending = new Map<string, PendingEntry>();
    private readonly sessionKeys = new Map<string, DirectionalKeys>();
    private readonly commandSender: CommandSenderInterface;
    private readonly serverSecretKey: Uint8Array;

    constructor(config: ReplBrokerConfig) {
        this.commandSender = config.commandSender;
        this.serverSecretKey = config.serverSecretKey;
    }

    sendEval(connectionId: string, code: string, timeoutMs = DEFAULT_EVAL_TIMEOUT_MS): Promise<ReplEvalResult> {
        const keys = this.sessionKeys.get(connectionId);
        if (!keys) {
            return Promise.reject(new Error(`No REPL session for connection ${connectionId} — handshake not complete`));
        }

        const { nonce, box } = secretboxEncrypt(jsonToBytes({ type: 'eval', code }), keys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        return this.sendPendingMessage<ReplEvalResult>(connectionId, encryptedPayload, timeoutMs, (raw) => {
            return this.decryptResponse<ReplEvalResult>(raw, keys.c2s);
        });
    }

    sendCompletions(
        connectionId: string,
        prefix: string,
        maxResults?: number,
        timeoutMs = DEFAULT_COMPLETIONS_TIMEOUT_MS
    ): Promise<ReplCompletionsResult> {
        const keys = this.sessionKeys.get(connectionId);
        if (!keys) {
            return Promise.reject(new Error(`No REPL session for connection ${connectionId} — handshake not complete`));
        }

        const { nonce, box } = secretboxEncrypt(jsonToBytes({ type: 'completions', prefix, maxResults }), keys.s2c);
        const encryptedPayload = encodeEnvelope(nonce, box);

        return this.sendPendingMessage<ReplCompletionsResult>(connectionId, encryptedPayload, timeoutMs, (raw) => {
            return this.decryptResponse<ReplCompletionsResult>(raw, keys.c2s);
        });
    }

    handleAgentMessage(connectionId: string, correlationId: string, payload: unknown): void {
        if (correlationId === 'handshake') {
            this.handleHandshake(connectionId, payload);
            return;
        }

        const entry = this.pending.get(correlationId);
        if (!entry) {
            this.logger.warn('No pending request for correlationId', { correlationId });
            return;
        }
        entry.resolve(payload);
        this.logger.debug('Resolved agent response', { correlationId });
    }

    removeConnection(connectionId: string): void {
        this.sessionKeys.delete(connectionId);
        this.logger.debug('Removed REPL session', { connectionId });
    }

    shutdown(): void {
        for (const [correlationId, entry] of this.pending.entries()) {
            clearTimeout(entry.timer);
            entry.reject(new Error(`REPL broker shutting down (correlationId: ${correlationId})`));
        }
        this.pending.clear();
        this.sessionKeys.clear();
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private handleHandshake(connectionId: string, payload: unknown): void {
        try {
            const { headerToken } = payload as { type: string; headerToken: string };
            const { clientEphemeralPublicKey, nonce, ciphertext } = decodeHeaderToken(headerToken);
            const sessionSeed = openSessionSeed(
                { nonce, box: ciphertext },
                clientEphemeralPublicKey,
                this.serverSecretKey
            );
            const keys = deriveDirectionalKeys(sessionSeed);
            this.sessionKeys.set(connectionId, keys);
            this.logger.debug('REPL handshake complete', { connectionId });
        } catch (error) {
            this.logger.warn('REPL handshake failed', { connectionId, error: String(error) });
        }
    }

    private sendPendingMessage<T>(
        connectionId: string,
        encryptedPayload: string,
        timeoutMs: number,
        transform: (raw: unknown) => T
    ): Promise<T> {
        const correlationId = uuidv4();
        let resolve!: (value: unknown) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<unknown>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timer = setTimeout(
            () => reject(new Error(`REPL request timed out after ${timeoutMs}ms`)),
            timeoutMs
        );

        this.pending.set(correlationId, { resolve, reject, timer });

        this.commandSender.sendToClient(connectionId, {
            t: PLUGIN_MESSAGE_T,
            pluginId: REPL_PLUGIN_ID,
            correlationId,
            payload: encryptedPayload,
        });

        this.logger.debug('Sent encrypted plugin message', { connectionId, correlationId });

        return promise.finally(() => {
            clearTimeout(timer);
            this.pending.delete(correlationId);
        }).then(transform) as Promise<T>;
    }

    private decryptResponse<T>(raw: unknown, key: Uint8Array): T {
        if (typeof raw !== 'string') {
            throw new Error('Expected encrypted string response from agent');
        }
        const { nonce, ciphertext } = decodeEnvelope(raw);
        const plaintext = secretboxDecrypt(nonce, ciphertext, key);
        return bytesToJson<T>(plaintext);
    }
}
