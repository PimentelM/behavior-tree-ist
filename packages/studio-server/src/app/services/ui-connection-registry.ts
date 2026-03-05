import { UiConnectionRegistryInterface } from '../interfaces';
import { UiConnection } from '../../domain/types';

export class UiConnectionRegistry implements UiConnectionRegistryInterface {
    private connections = new Map<string, UiConnection>();

    register(connectionId: string): void {
        this.connections.set(connectionId, {
            connectionId,
            connectedAt: Date.now(),
        });
    }

    unregister(connectionId: string): UiConnection | undefined {
        const connection = this.connections.get(connectionId);
        if (connection) {
            this.connections.delete(connectionId);
        }
        return connection;
    }

    getConnection(connectionId: string): UiConnection | undefined {
        return this.connections.get(connectionId);
    }

    getAllConnections(): UiConnection[] {
        return Array.from(this.connections.values());
    }
}
