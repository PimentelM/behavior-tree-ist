import { v4 as uuidv4 } from 'uuid';
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
    handleAgentResponse(correlationId: string, payload: unknown): void;
    shutdown(): void;
}

export class ReplBroker implements ReplBrokerInterface {
    private readonly logger = createLogger('repl-broker');
    private readonly pending = new Map<string, PendingEntry>();

    constructor(private readonly commandSender: CommandSenderInterface) {}

    sendEval(connectionId: string, code: string, timeoutMs = DEFAULT_EVAL_TIMEOUT_MS): Promise<ReplEvalResult> {
        const correlationId = uuidv4();
        let resolve!: (value: unknown) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<unknown>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timer = setTimeout(
            () => reject(new Error(`REPL eval timed out after ${timeoutMs}ms`)),
            timeoutMs
        );

        this.pending.set(correlationId, { resolve, reject, timer });

        this.commandSender.sendToClient(connectionId, {
            t: PLUGIN_MESSAGE_T,
            pluginId: REPL_PLUGIN_ID,
            correlationId,
            payload: { type: 'eval', code },
        });

        this.logger.debug('Sent eval request', { connectionId, correlationId });

        return promise.finally(() => {
            clearTimeout(timer);
            this.pending.delete(correlationId);
        }) as Promise<ReplEvalResult>;
    }

    sendCompletions(
        connectionId: string,
        prefix: string,
        maxResults?: number,
        timeoutMs = DEFAULT_COMPLETIONS_TIMEOUT_MS
    ): Promise<ReplCompletionsResult> {
        const correlationId = uuidv4();
        let resolve!: (value: unknown) => void;
        let reject!: (reason?: unknown) => void;

        const promise = new Promise<unknown>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        const timer = setTimeout(
            () => reject(new Error(`REPL completions timed out after ${timeoutMs}ms`)),
            timeoutMs
        );

        this.pending.set(correlationId, { resolve, reject, timer });

        this.commandSender.sendToClient(connectionId, {
            t: PLUGIN_MESSAGE_T,
            pluginId: REPL_PLUGIN_ID,
            correlationId,
            payload: { type: 'completions', prefix, maxResults },
        });

        this.logger.debug('Sent completions request', { connectionId, correlationId });

        return promise.finally(() => {
            clearTimeout(timer);
            this.pending.delete(correlationId);
        }) as Promise<ReplCompletionsResult>;
    }

    handleAgentResponse(correlationId: string, payload: unknown): void {
        const entry = this.pending.get(correlationId);
        if (!entry) {
            this.logger.warn('No pending request for correlationId', { correlationId });
            return;
        }
        entry.resolve(payload);
        this.logger.debug('Resolved agent response', { correlationId });
    }

    shutdown(): void {
        for (const [correlationId, entry] of this.pending.entries()) {
            clearTimeout(entry.timer);
            entry.reject(new Error(`REPL broker shutting down (correlationId: ${correlationId})`));
        }
        this.pending.clear();
    }
}
