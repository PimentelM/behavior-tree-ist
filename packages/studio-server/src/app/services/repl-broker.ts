import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../infra/logging';
import { type CommandSenderInterface, type DomainEventDispatcherInterface } from '../interfaces';

const PLUGIN_MESSAGE_T = 7;
const REPL_PLUGIN_ID = 'repl';
export const DEFAULT_EVAL_TIMEOUT_MS = 15_000;
export const DEFAULT_COMPLETIONS_TIMEOUT_MS = 5_000;

type PendingEntry = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
};

export interface ReplBrokerInterface {
    relay(connectionId: string, encryptedPayload: string, timeoutMs?: number): Promise<string>;
    getHandshakeToken(connectionId: string): string | undefined;
    handleAgentMessage(connectionId: string, correlationId: string, payload: unknown): void;
    removeConnection(connectionId: string): void;
    shutdown(): void;
}

export interface ReplBrokerConfig {
    commandSender: CommandSenderInterface;
    eventDispatcher: DomainEventDispatcherInterface;
    resolveConnection: (connectionId: string) => { clientId: string; sessionId: string } | undefined;
}

export class ReplBroker implements ReplBrokerInterface {
    private readonly logger = createLogger('repl-broker');
    private readonly pending = new Map<string, PendingEntry>();
    private readonly handshakeTokens = new Map<string, string>();
    private readonly commandSender: CommandSenderInterface;
    private readonly eventDispatcher: DomainEventDispatcherInterface;
    private readonly resolveConnection: (connectionId: string) => { clientId: string; sessionId: string } | undefined;

    constructor(config: ReplBrokerConfig) {
        this.commandSender = config.commandSender;
        this.eventDispatcher = config.eventDispatcher;
        this.resolveConnection = config.resolveConnection;
    }

    relay(connectionId: string, encryptedPayload: string, timeoutMs = DEFAULT_EVAL_TIMEOUT_MS): Promise<string> {
        if (!this.handshakeTokens.has(connectionId)) {
            return Promise.reject(new Error(`No REPL session for connection ${connectionId} — handshake not complete`));
        }

        const correlationId = uuidv4();
        let resolve!: (value: unknown) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<unknown>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timer = setTimeout(
            () => { reject(new Error(`REPL request timed out after ${timeoutMs}ms`)); },
            timeoutMs
        );

        this.pending.set(correlationId, { resolve, reject, timer });

        this.commandSender.sendToClient(connectionId, {
            t: PLUGIN_MESSAGE_T,
            pluginId: REPL_PLUGIN_ID,
            correlationId,
            payload: encryptedPayload,
        });

        this.logger.debug('Relayed encrypted plugin message', { connectionId, correlationId });

        return promise.finally(() => {
            clearTimeout(timer);
            this.pending.delete(correlationId);
        }).then((raw) => {
            if (typeof raw !== 'string') {
                throw new Error('Expected encrypted string response from agent');
            }
            const conn = this.resolveConnection(connectionId);
            if (conn) {
                void this.eventDispatcher.dispatchAgentEvent({
                    name: 'ReplActivity',
                    body: {
                        clientId: conn.clientId,
                        sessionId: conn.sessionId,
                        encryptedRequest: encryptedPayload,
                        encryptedResponse: raw,
                        timestamp: Date.now(),
                    },
                });
            }
            return raw;
        });
    }

    getHandshakeToken(connectionId: string): string | undefined {
        return this.handshakeTokens.get(connectionId);
    }

    handleAgentMessage(connectionId: string, correlationId: string, payload: unknown): void {
        if (correlationId === 'handshake') {
            const { headerToken } = payload as { type: string; headerToken: string };
            if (typeof headerToken === 'string') {
                this.handshakeTokens.set(connectionId, headerToken);
                this.logger.debug('Stored REPL handshake token', { connectionId });
            } else {
                this.logger.warn('REPL handshake missing headerToken', { connectionId });
            }
            return;
        }

        const entry = this.pending.get(correlationId);
        if (!entry) {
            this.logger.warn('No pending request for correlationId', { correlationId });
            return;
        }
        entry.resolve(payload);
        this.logger.debug('Relayed agent response', { correlationId });
    }

    removeConnection(connectionId: string): void {
        this.handshakeTokens.delete(connectionId);
        this.logger.debug('Removed REPL session', { connectionId });
    }

    shutdown(): void {
        for (const [correlationId, entry] of this.pending.entries()) {
            clearTimeout(entry.timer);
            entry.reject(new Error(`REPL broker shutting down (correlationId: ${correlationId})`));
        }
        this.pending.clear();
        this.handshakeTokens.clear();
    }
}
