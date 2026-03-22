import { ReplClient } from '@bt-studio/studio-plugins';
import type { AppRouter } from '@bt-studio/studio-server';
import { type TRPCClient } from '@trpc/client';

export class SessionManager {
    private readonly _privateKey: Uint8Array;
    readonly publicKey: Uint8Array;
    private readonly _sessions = new Map<string, ReplClient>();
    private readonly _trpc: TRPCClient<AppRouter>;

    constructor(privateKey: Uint8Array, trpc: TRPCClient<AppRouter>) {
        this._privateKey = privateKey;
        this.publicKey = new ReplClient(privateKey).publicKey;
        this._trpc = trpc;
    }

    private _sessionKey(clientId: string, sessionId: string): string {
        return `${clientId}:${sessionId}`;
    }

    private _getOrCreate(clientId: string, sessionId: string): ReplClient {
        const key = this._sessionKey(clientId, sessionId);
        let client = this._sessions.get(key);
        if (!client) {
            client = new ReplClient(this._privateKey);
            this._sessions.set(key, client);
        }
        return client;
    }

    /** Perform the handshake for (clientId, sessionId). Re-uses existing ready session. */
    async ensureHandshake(clientId: string, sessionId: string): Promise<ReplClient> {
        const client = this._getOrCreate(clientId, sessionId);
        if (client.isReady) return client;
        return this._doHandshake(clientId, sessionId, client);
    }

    /** Reset the session for (clientId, sessionId) and perform a fresh handshake. */
    async rehandshake(clientId: string, sessionId: string): Promise<ReplClient> {
        const key = this._sessionKey(clientId, sessionId);
        const client = this._sessions.get(key) ?? new ReplClient(this._privateKey);
        client.resetSession();
        this._sessions.set(key, client);
        return this._doHandshake(clientId, sessionId, client);
    }

    /** Remove all cached sessions. */
    clear(): void {
        this._sessions.clear();
    }

    private async _doHandshake(clientId: string, sessionId: string, client: ReplClient): Promise<ReplClient> {
        let result: { headerToken: string };
        try {
            result = await this._trpc.repl.handshake.query({ clientId, sessionId });
        } catch (err) {
            throw new Error(
                `Failed to retrieve handshake token for agent ${clientId}:${sessionId}: ${String(err)}. ` +
                    `Ensure the agent is connected and has ReplPlugin attached.`,
            );
        }

        try {
            client.completeHandshake(result.headerToken);
        } catch (err) {
            throw new Error(
                `Handshake decryption failed for agent ${clientId}:${sessionId}: ${String(err)}. ` +
                    `Agent X is not configured with this MCP's public key. ` +
                    `Configure the agent with ReplPlugin({ publicKey: <MCP_PUBLIC_KEY> }).`,
            );
        }

        return client;
    }
}
