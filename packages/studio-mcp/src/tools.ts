import { base64urlEncode } from '@bt-studio/studio-plugins';
import type { AppRouter } from '@bt-studio/studio-server';
import { type TRPCClient } from '@trpc/client';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type SessionManager } from './session-manager';
import type { McpConfig } from './config';

export type { CallToolResult };

export interface EvalArgs {
    code: string;
    clientId?: string;
    sessionId?: string;
    timeout?: number;
}

export interface CompletionsArgs {
    prefix: string;
    clientId?: string;
    sessionId?: string;
    maxResults?: number;
}

type AgentIdentity = {
    clientId: string;
    sessionId: string;
};

/** Resolve an agent from (optional) clientId/sessionId. Auto-selects if exactly one agent is online. */
async function resolveAgent(
    trpc: TRPCClient<AppRouter>,
    clientId?: string,
    sessionId?: string,
): Promise<AgentIdentity> {
    if (clientId && sessionId) {
        return { clientId, sessionId };
    }

    const clients = await trpc.clients.getAll.query();
    const onlineClients = clients.filter((c) => c.online);

    if (onlineClients.length === 0) {
        throw new Error('No agents are currently connected to the studio server.');
    }

    let candidates: AgentIdentity[] = [];

    if (clientId) {
        // clientId given but no sessionId — pick online sessions for this client
        const sessions = await trpc.sessions.getByClientId.query({ clientId });
        const onlineSessions = sessions.filter((s) => s.online);
        if (onlineSessions.length === 0) {
            throw new Error(`Agent ${clientId} has no online sessions.`);
        }
        candidates = onlineSessions.map((s) => ({ clientId: s.clientId, sessionId: s.sessionId }));
    } else {
        // Neither clientId nor sessionId — gather all online sessions
        for (const client of onlineClients) {
            const sessions = await trpc.sessions.getByClientId.query({ clientId: client.clientId });
            for (const s of sessions) {
                if (s.online) {
                    candidates.push({ clientId: s.clientId, sessionId: s.sessionId });
                }
            }
        }
    }

    if (candidates.length === 0) {
        throw new Error('No online sessions found.');
    }
    if (candidates.length > 1) {
        const list = candidates.map((c) => `${c.clientId}:${c.sessionId}`).join(', ');
        throw new Error(
            `Multiple online agents found: [${list}]. Specify clientId and sessionId to select one.`,
        );
    }

    const candidate = candidates[0];
    if (!candidate) {
        throw new Error('No online sessions found.');
    }
    return candidate;
}

function textResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }] };
}

function errorResult(text: string): CallToolResult {
    return { content: [{ type: 'text', text }], isError: true };
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

export function handleGetPublicKey(sessions: SessionManager): CallToolResult {
    const pubKey = base64urlEncode(sessions.publicKey);
    return textResult(
        `MCP public key (base64url): ${pubKey}\n\n` +
            `Configure your agents with:\n` +
            `  new ReplPlugin({ publicKey: base64urlDecode('${pubKey}') })`,
    );
}

export async function handleListAgents(trpc: TRPCClient<AppRouter>): Promise<CallToolResult> {
    const clients = await trpc.clients.getAll.query();

    if (clients.length === 0) {
        return textResult('No agents registered.');
    }

    const lines: string[] = [];
    for (const client of clients) {
        const status = client.online ? '● online' : '○ offline';
        lines.push(`${status}  clientId=${client.clientId}`);

        if (client.online) {
            const sessions = await trpc.sessions.getByClientId.query({ clientId: client.clientId });
            for (const s of sessions) {
                if (s.online) {
                    // Check REPL readiness (handshake token available)
                    let replReady = false;
                    try {
                        await trpc.repl.handshake.query({ clientId: s.clientId, sessionId: s.sessionId });
                        replReady = true;
                    } catch {
                        replReady = false;
                    }
                    const replStatus = replReady ? 'repl=ready' : 'repl=not-ready';
                    lines.push(`    session=${s.sessionId}  ${replStatus}`);
                }
            }
        }
    }

    return textResult(lines.join('\n'));
}

export async function handleEval(
    trpc: TRPCClient<AppRouter>,
    sessions: SessionManager,
    config: McpConfig,
    args: EvalArgs,
): Promise<CallToolResult> {
    const { code, clientId, sessionId } = args;

    let identity: AgentIdentity;
    try {
        identity = await resolveAgent(trpc, clientId, sessionId);
    } catch (err) {
        return errorResult(String(err));
    }

    const { clientId: resolvedClientId, sessionId: resolvedSessionId } = identity;

    // Ensure handshake, then encrypt, relay, and decrypt with lazy re-handshake on failure.
    const evalWithRetry = async (isRetry: boolean): Promise<CallToolResult> => {
        let client;
        try {
            client = isRetry
                ? await sessions.rehandshake(resolvedClientId, resolvedSessionId)
                : await sessions.ensureHandshake(resolvedClientId, resolvedSessionId);
        } catch (err) {
            return errorResult(String(err));
        }

        const encryptedPayload = client.encryptEval(code);

        let response: { encryptedPayload: string };
        try {
            response = await trpc.repl.eval.mutate({
                clientId: resolvedClientId,
                sessionId: resolvedSessionId,
                encryptedPayload,
            });
        } catch (err) {
            return errorResult(`eval relay failed: ${String(err)}`);
        }

        let result;
        try {
            result = client.decryptEvalResponse(response.encryptedPayload);
        } catch {
            // Stale session — lazy re-handshake once
            if (!isRetry) {
                return evalWithRetry(true);
            }
            return errorResult('Decryption failed after re-handshake. Agent may have changed its key configuration.');
        }

        const lines: string[] = [];
        if (result.consoleOutput && result.consoleOutput.length > 0) {
            lines.push('Console output:', ...result.consoleOutput.map((l) => `  ${l}`), '');
        }
        lines.push(result.kind === 'error' ? `Error: ${result.text}` : result.text);

        return result.kind === 'error'
            ? errorResult(lines.join('\n'))
            : textResult(lines.join('\n'));
    };

    const timeoutMs = args.timeout ?? config.evalTimeoutMs;

    return Promise.race([
        evalWithRetry(false),
        new Promise<CallToolResult>((resolve) => {
            setTimeout(() => { resolve(errorResult(`eval timed out after ${timeoutMs}ms`)); }, timeoutMs);
        }),
    ]);
}

export async function handleCompletions(
    trpc: TRPCClient<AppRouter>,
    sessions: SessionManager,
    _config: McpConfig,
    args: CompletionsArgs,
): Promise<CallToolResult> {
    const { prefix, clientId, sessionId, maxResults } = args;

    let identity: AgentIdentity;
    try {
        identity = await resolveAgent(trpc, clientId, sessionId);
    } catch (err) {
        return errorResult(String(err));
    }

    const { clientId: resolvedClientId, sessionId: resolvedSessionId } = identity;

    const completionsWithRetry = async (isRetry: boolean): Promise<CallToolResult> => {
        let client;
        try {
            client = isRetry
                ? await sessions.rehandshake(resolvedClientId, resolvedSessionId)
                : await sessions.ensureHandshake(resolvedClientId, resolvedSessionId);
        } catch (err) {
            return errorResult(String(err));
        }

        const encryptedPayload = client.encryptCompletions(prefix, maxResults);

        let response: { encryptedPayload: string };
        try {
            response = await trpc.repl.completions.mutate({
                clientId: resolvedClientId,
                sessionId: resolvedSessionId,
                encryptedPayload,
            });
        } catch (err) {
            return errorResult(`completions relay failed: ${String(err)}`);
        }

        let result;
        try {
            result = client.decryptCompletionsResponse(response.encryptedPayload);
        } catch {
            if (!isRetry) {
                return completionsWithRetry(true);
            }
            return errorResult('Decryption failed after re-handshake.');
        }

        return textResult(
            result.completions.length > 0 ? result.completions.join('\n') : '(no completions)',
        );
    };

    return completionsWithRetry(false);
}
