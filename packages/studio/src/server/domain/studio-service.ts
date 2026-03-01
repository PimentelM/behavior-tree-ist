import { SerializableNode, TickRecord } from "@behavior-tree-ist/core";
import { ClientRepository, TreeRepository, TickRepository, AgentGateway } from "./interfaces";
import { ClientNotFoundError, TreeNotFoundError } from "./errors";
import { computeTreeHash } from "./hash";

export class StudioService {
    constructor(
        private readonly clientRepo: ClientRepository,
        private readonly treeRepo: TreeRepository,
        private readonly tickRepo: TickRepository,
        private readonly agentGateway: AgentGateway
    ) { }

    public registerClient(clientId: string): void {
        this.clientRepo.upsert({
            clientId,
            isOnline: true,
            connectedAt: Date.now(),
            disconnectedAt: undefined
        });
    }

    public unregisterClient(clientId: string): void {
        const client = this.clientRepo.findById(clientId);
        if (client) {
            this.clientRepo.setOnline(clientId, false, Date.now());
        }
        // Cleanup resources for disconnected client
        this.treeRepo.deleteByClient(clientId);
        this.tickRepo.clearByClient(clientId);
    }

    public registerTree(clientId: string, treeId: string, serializedTree: SerializableNode): void {
        if (!this.clientRepo.findById(clientId)) {
            throw new ClientNotFoundError(clientId);
        }

        const hash = computeTreeHash(serializedTree);
        this.treeRepo.upsert(clientId, treeId, serializedTree, hash);
        this.tickRepo.clearByTree(clientId, treeId); // Reset ticks for new tree
    }

    public unregisterTree(clientId: string, treeId: string): void {
        this.treeRepo.delete(clientId, treeId);
        this.tickRepo.clearByTree(clientId, treeId);
    }

    public updateTree(clientId: string, treeId: string, serializedTree: SerializableNode): void {
        const existing = this.treeRepo.find(clientId, treeId);
        if (!existing) {
            throw new TreeNotFoundError(clientId, treeId);
        }

        const hash = computeTreeHash(serializedTree);
        if (existing.hash !== hash) {
            this.treeRepo.upsert(clientId, treeId, serializedTree, hash);
        }
    }

    public processTicks(clientId: string, treeId: string, ticks: TickRecord[]): void {
        if (!this.treeRepo.find(clientId, treeId)) {
            throw new TreeNotFoundError(clientId, treeId);
        }
        this.tickRepo.push(clientId, treeId, ticks);
    }

    public async enableStreaming(clientId: string, treeId: string): Promise<void> {
        await this.sendCommand(clientId, treeId, "enable-streaming");
    }

    public async disableStreaming(clientId: string, treeId: string): Promise<void> {
        await this.sendCommand(clientId, treeId, "disable-streaming");
    }

    private async sendCommand(clientId: string, treeId: string, command: string): Promise<void> {
        if (!this.clientRepo.findById(clientId)?.isOnline) {
            throw new ClientNotFoundError(clientId);
        }
        if (!this.treeRepo.find(clientId, treeId)) {
            throw new TreeNotFoundError(clientId, treeId);
        }

        const correlationId = Math.random().toString(36).substring(2, 10);

        return new Promise<void>((resolve, reject) => {
            let timeout: ReturnType<typeof setTimeout>;

            const unsub = this.agentGateway.onCommandAck((ack) => {
                if (ack.correlationId === correlationId) {
                    clearTimeout(timeout);
                    unsub();
                    if (ack.success) {
                        resolve();
                    } else {
                        reject(new Error(ack.error ?? "Command failed"));
                    }
                }
            });

            timeout = setTimeout(() => {
                unsub();
                reject(new Error("Command timed out"));
            }, 5000); // 5s timeout

            this.agentGateway.sendCommand(clientId, correlationId, command, treeId).catch((err) => {
                clearTimeout(timeout);
                unsub();
                reject(err);
            });
        });
    }
}
