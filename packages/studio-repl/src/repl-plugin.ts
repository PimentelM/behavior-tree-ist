/**
 * REPL plugin — agent-side implementation.
 * Ported from references/Frostmod/packages/mod-client/src/domain/services/repl-service.ts.
 *
 * Provides:
 *  - JavaScript eval with console capture
 *  - Declaration rewriting for variable persistence (let x=1 → globalThis.x=1)
 *  - Tab-completion via prototype-chain enumeration
 *  - NaCl end-to-end encryption (handshake + per-message secretbox)
 */
import {
    bytesToJson,
    decodeEnvelope,
    deriveDirectionalKeys,
    encodeEnvelope,
    encodeHeaderToken,
    generateEphemeralKeyPair,
    getRandomBytes,
    jsonToBytes,
    sealSessionSeed,
    secretboxDecrypt,
    secretboxEncrypt,
    type DirectionalKeys,
} from './repl-crypto';
import type { PluginSender, StudioPlugin } from '@bt-studio/core';
import type {
    ReplAction,
    ReplCompletionsPayload,
    ReplHandshakePayload,
    ReplOutputPayload,
    ReplPluginConfig,
} from './repl-types';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function toDisplayString(value: unknown): string {
    try {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
        ) {
            return String(value);
        }
        if (typeof value === 'function') {
            const name = (value as { name?: string }).name || 'anonymous';
            return `[Function ${name}]`;
        }
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'object') {
            try {
                return JSON.stringify(
                    value,
                    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
                    2,
                );
            } catch {
                const ctor = (value as { constructor?: { name?: string } })?.constructor?.name ?? 'Object';
                const keys = Object.keys(value as object).slice(0, 20);
                return `[${ctor} { ${keys.join(', ')}${keys.length >= 20 ? ', ...' : ''} }]`;
            }
        }
    } catch (err) {
        return `[[toString error]] ${err}`;
    }
    return String(value);
}

export function getPropertyNamesDeep(target: unknown): string[] {
    const props = new Set<string>();
    try {
        let obj: unknown = target;
        let depth = 0;
        while (obj && depth < 3) {
            Object.getOwnPropertyNames(obj).forEach((p) => props.add(p));
            obj = Object.getPrototypeOf(obj as object) as unknown;
            depth++;
        }
    } catch {
        // ignore
    }
    return Array.from(props.values());
}

export function resolvePath(root: unknown, pathSegments: string[]): unknown {
    let current = root;
    for (const seg of pathSegments) {
        if (!seg) continue;
        if (current == null) return undefined;
        try {
            current = (current as Record<string, unknown>)[seg];
        } catch {
            return undefined;
        }
    }
    return current;
}

export function isProbablyExpression(sourceCode: string): boolean {
    try {
        const trimmed = (sourceCode ?? '').trim();
        if (!trimmed) return false;
        if (
            /^(let|const|var|function|class|import|export|if|for|while|do|switch|try|with)\b/.test(
                trimmed,
            )
        ) {
            return false;
        }
        new Function(`return (${trimmed})`);
        return true;
    } catch {
        return false;
    }
}

export function rewriteTopLevelDeclarations(sourceCode: string): string {
    try {
        const lines = sourceCode.split(/\n/);
        const out: string[] = [];
        for (const line of lines) {
            const m = line.match(/^\s*(let|const|var)\s+(.+);?\s*$/);
            if (!m) {
                out.push(line);
                continue;
            }
            const decl = m[2]!;
            const parts = decl.split(',').map((s) => s.trim()).filter(Boolean);
            const assigns: string[] = [];
            for (const part of parts) {
                const eqIdx = part.indexOf('=');
                if (eqIdx >= 0) {
                    const name = part.slice(0, eqIdx).trim();
                    const expr = part.slice(eqIdx + 1).trim();
                    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
                        assigns.push(`globalThis.${name} = ${expr}`);
                    } else {
                        // Destructuring — fall back to original
                        assigns.length = 0;
                        break;
                    }
                } else {
                    const name = part.trim();
                    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
                        assigns.push(`globalThis.${name} = undefined`);
                    } else {
                        assigns.length = 0;
                        break;
                    }
                }
            }
            out.push(assigns.length > 0 ? assigns.join('; ') : line);
        }
        return out.join('\n');
    } catch {
        return sourceCode;
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(`Evaluation timed out after ${ms} ms`);
            (err as { name: string }).name = 'TimeoutError';
            reject(err);
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// ReplPlugin
// ---------------------------------------------------------------------------

const EVAL_TIMEOUT_MS = 15_000;

export class ReplPlugin implements StudioPlugin {
    readonly pluginId = 'repl';

    private sender: PluginSender | null = null;
    private sessionKeys: DirectionalKeys | null = null;

    constructor(private readonly config: ReplPluginConfig) {}

    attach(sender: PluginSender): void {
        this.sender = sender;
        this.doHandshake();
    }

    detach(): void {
        this.sender = null;
        this.sessionKeys = null;
    }

    async handleInbound(correlationId: string, encryptedPayload: unknown): Promise<void> {
        if (!this.sessionKeys) return; // handshake not complete

        let action: ReplAction;
        try {
            action = this.decryptAction(encryptedPayload);
        } catch {
            // Silently drop malformed/unauthenticated messages
            return;
        }

        if (action.type === 'eval') {
            await this.handleEval(correlationId, action.code);
        } else if (action.type === 'completions') {
            this.handleCompletions(correlationId, action.prefix, action.maxResults);
        }
    }

    // -------------------------------------------------------------------------
    // Handshake
    // -------------------------------------------------------------------------

    private doHandshake(): void {
        const ephemeral = generateEphemeralKeyPair();
        const sessionSeed = getRandomBytes(32);
        const { nonce, box } = sealSessionSeed(
            sessionSeed,
            this.config.serverPublicKey,
            ephemeral.secretKey,
        );
        const headerToken = encodeHeaderToken({
            version: 1,
            clientEphemeralPublicKey: ephemeral.publicKey,
            nonce,
            ciphertext: box,
        });

        this.sessionKeys = deriveDirectionalKeys(sessionSeed);

        const payload: ReplHandshakePayload = { type: 'handshake', headerToken };
        this.sender?.send('handshake', payload);
    }

    // -------------------------------------------------------------------------
    // Eval
    // -------------------------------------------------------------------------

    private async handleEval(correlationId: string, code: string): Promise<void> {
        const consoleOutput: string[] = [];

        const captureConsole = {
            log: (...args: unknown[]) => consoleOutput.push(args.map(String).join(' ')),
            warn: (...args: unknown[]) => consoleOutput.push(`WARN: ${args.map(String).join(' ')}`),
            error: (...args: unknown[]) => consoleOutput.push(`ERROR: ${args.map(String).join(' ')}`),
            info: (...args: unknown[]) => consoleOutput.push(`INFO: ${args.map(String).join(' ')}`),
        };

        try {
            const isExpr = isProbablyExpression(code);
            const body = isExpr
                ? `const console = arguments[0]; return (async () => ( ${code} ))();`
                : `const console = arguments[0]; return (async () => { ${rewriteTopLevelDeclarations(code)}\n })();`;

            const fn = new Function(body) as (console: typeof captureConsole) => Promise<unknown>;
            const result = await withTimeout(fn(captureConsole), EVAL_TIMEOUT_MS);
            const text = toDisplayString(result);

            this.sendEncrypted(correlationId, {
                type: 'result',
                kind: 'result',
                text,
                ...(consoleOutput.length > 0 ? { consoleOutput } : {}),
            } satisfies ReplOutputPayload);
        } catch (error: unknown) {
            const isTimeout = (error as { name?: string })?.name === 'TimeoutError';
            const text = isTimeout
                ? (error as Error).message
                : ((error as { stack?: string })?.stack ?? String(error));

            this.sendEncrypted(correlationId, {
                type: 'error',
                kind: 'error',
                text,
                ...(consoleOutput.length > 0 ? { consoleOutput } : {}),
            } satisfies ReplOutputPayload);
        }
    }

    // -------------------------------------------------------------------------
    // Completions
    // -------------------------------------------------------------------------

    private handleCompletions(correlationId: string, prefix: string, maxResults?: number): void {
        try {
            let baseObject: unknown = globalThis;
            let needle = prefix;

            const lastDot = prefix.lastIndexOf('.');
            if (lastDot >= 0) {
                const objectPath = prefix.slice(0, lastDot);
                needle = prefix.slice(lastDot + 1);
                const segments = objectPath.split('.').filter(Boolean);
                if (segments[0] === 'globalThis') segments.shift();
                baseObject = resolvePath(globalThis, segments);
            }

            const candidates = baseObject ? getPropertyNamesDeep(baseObject) : [];
            const filtered = candidates
                .filter((name) => !needle || name.toLowerCase().startsWith(needle.toLowerCase()))
                .slice(0, maxResults ?? 50);

            this.sendEncrypted(correlationId, {
                type: 'completions',
                completions: filtered,
            } satisfies ReplCompletionsPayload);
        } catch {
            this.sendEncrypted(correlationId, {
                type: 'completions',
                completions: [],
            } satisfies ReplCompletionsPayload);
        }
    }

    // -------------------------------------------------------------------------
    // Crypto helpers
    // -------------------------------------------------------------------------

    private decryptAction(encryptedPayload: unknown): ReplAction {
        if (!this.sessionKeys) throw new Error('No session keys');
        if (typeof encryptedPayload !== 'string') throw new Error('Expected string payload');
        const { nonce, ciphertext } = decodeEnvelope(encryptedPayload);
        const plaintext = secretboxDecrypt(nonce, ciphertext, this.sessionKeys.s2c);
        return bytesToJson<ReplAction>(plaintext);
    }

    private sendEncrypted(correlationId: string, payload: object): void {
        if (!this.sender || !this.sessionKeys) return;
        const { nonce, box } = secretboxEncrypt(jsonToBytes(payload), this.sessionKeys.c2s);
        const envelope = encodeEnvelope(nonce, box);
        this.sender.send(correlationId, envelope);
    }
}
