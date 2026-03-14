import { type AgentConnectionRegistryInterface } from '../interfaces';
import { type AgentConnection } from '../../domain/types';

export class AgentConnectionRegistry implements AgentConnectionRegistryInterface {
    private byIdentity = new Map<string, AgentConnection>();
    private byConnectionId = new Map<string, string>();

    private makeKey(clientId: string, sessionId: string): string {
        return `${clientId}:${sessionId}`;
    }

    register(connectionId: string, clientId: string, sessionId: string): void {
        const key = this.makeKey(clientId, sessionId);

        // If the same identity already exists with a different connection ID, clean up old mapping
        const existing = this.byIdentity.get(key);
        if (existing && existing.connectionId !== connectionId) {
            this.byConnectionId.delete(existing.connectionId);
        }

        const connection: AgentConnection = {
            connectionId,
            clientId,
            sessionId,
            connectedAt: Date.now(),
        };

        this.byIdentity.set(key, connection);
        this.byConnectionId.set(connectionId, key);
    }

    unregisterByConnectionId(connectionId: string): AgentConnection | undefined {
        const key = this.byConnectionId.get(connectionId);
        if (!key) return undefined;

        const connection = this.byIdentity.get(key);
        this.byIdentity.delete(key);
        this.byConnectionId.delete(connectionId);
        return connection;
    }

    getByConnectionId(connectionId: string): AgentConnection | undefined {
        const key = this.byConnectionId.get(connectionId);
        if (!key) {
            return undefined;
        }
        return this.byIdentity.get(key);
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
