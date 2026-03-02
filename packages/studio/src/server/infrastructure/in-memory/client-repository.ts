import { ClientRepository, Client } from "../../domain";

export class InMemoryClientRepository implements ClientRepository {
    private readonly clients = new Map<string, Client>();

    upsert(client: Client): void {
        this.clients.set(client.clientId, { ...client });
    }

    findById(clientId: string): Client | undefined {
        const client = this.clients.get(clientId);
        return client ? { ...client } : undefined;
    }

    findAll(): Client[] {
        return Array.from(this.clients.values()).map(c => ({ ...c }));
    }

    delete(clientId: string): void {
        this.clients.delete(clientId);
    }

    setOnline(clientId: string, isOnline: boolean, timestamp: number): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.isOnline = isOnline;
            if (isOnline) {
                client.connectedAt = timestamp;
                client.disconnectedAt = undefined;
            } else {
                client.disconnectedAt = timestamp;
            }
        }
    }
}
