import { AgentConnectionRegistryInterface } from '../interfaces';
import { AgentConnection } from '../types';

export class AgentConnectionRegistry implements AgentConnectionRegistryInterface {
    private byIdentity = new Map<string, AgentConnection>();
    private byWsClientId = new Map<string, string>();

    private makeKey(clientId: string, sessionId: string): string {
        return `${clientId}:${sessionId}`;
    }

    register(wsClientId: string, clientId: string, sessionId: string): void {
        const key = this.makeKey(clientId, sessionId);

        // If the same identity already exists with a different wsClientId, clean up old mapping
        const existing = this.byIdentity.get(key);
        if (existing && existing.wsClientId !== wsClientId) {
            this.byWsClientId.delete(existing.wsClientId);
        }

        const connection: AgentConnection = {
            wsClientId,
            clientId,
            sessionId,
            connectedAt: Date.now(),
        };

        this.byIdentity.set(key, connection);
        this.byWsClientId.set(wsClientId, key);
    }

    unregisterByWsClientId(wsClientId: string): AgentConnection | undefined {
        const key = this.byWsClientId.get(wsClientId);
        if (!key) return undefined;

        const connection = this.byIdentity.get(key);
        this.byIdentity.delete(key);
        this.byWsClientId.delete(wsClientId);
        return connection;
    }

    getByIdentity(clientId: string, sessionId: string): AgentConnection | undefined {
        return this.byIdentity.get(this.makeKey(clientId, sessionId));
    }

    getAllConnections(): AgentConnection[] {
        return Array.from(this.byIdentity.values());
    }

    isOnline(clientId: string, sessionId: string): boolean {
        return this.byIdentity.has(this.makeKey(clientId, sessionId));
    }
}
