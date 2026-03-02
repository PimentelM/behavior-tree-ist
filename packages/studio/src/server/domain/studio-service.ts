import { SerializableNode, TickRecord } from "@behavior-tree-ist/core";
import { ClientRepository, TreeRepository, TickRepository, AgentGateway } from "./interfaces";
import { ClientNotFoundError, TreeNotFoundError } from "./errors";
import { computeTreeHash } from "./hash";

export interface CommandDispatchResult {
    success: boolean;
    errorCode?: string;
    errorMessage?: string;
}

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
        // Do NOT delete trees or ticks on disconnect - Offline Retention criteria
    }

    public deleteClient(clientId: string): void {
        this.clientRepo.delete(clientId);
        this.treeRepo.deleteByClient(clientId);
        this.tickRepo.clearByClient(clientId);
    }

    public registerTree(clientId: string, treeId: string, serializedTree: SerializableNode): void {
        const hash = computeTreeHash(serializedTree);
        const existingHash = this.treeRepo.find(clientId, treeId)?.hash;

        this.treeRepo.upsert(clientId, treeId, serializedTree, hash);

        // Only clear ticks if the tree hash changed
        if (existingHash !== hash) {
            this.tickRepo.clearByTree(clientId, treeId);
        }
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
        console.log(`[StudioService] registerTree: ${clientId}:${treeId}, hash eval: old=${this.treeRepo.find(clientId, treeId)?.hash} new=${hash}`);
        if (existing.hash !== hash) {
            this.treeRepo.upsert(clientId, treeId, serializedTree, hash);
            this.tickRepo.clearByTree(clientId, treeId);
        }
    }

    public processTicks(clientId: string, treeId: string, ticks: TickRecord[]): void {
        if (!this.treeRepo.find(clientId, treeId)) {
            throw new TreeNotFoundError(clientId, treeId);
        }
        console.log(`[StudioService] Pushing ${ticks.length} ticks to ${clientId}:${treeId}`);
        this.tickRepo.push(clientId, treeId, ticks);
    }

    public async enableStreaming(clientId: string, treeId: string): Promise<CommandDispatchResult> {
        return this.sendCommand(clientId, treeId, "enable-streaming");
    }

    public async disableStreaming(clientId: string, treeId: string): Promise<CommandDispatchResult> {
        return this.sendCommand(clientId, treeId, "disable-streaming");
    }

    public async sendCommand(clientId: string, treeId: string, command: string): Promise<CommandDispatchResult> {
        if (!this.clientRepo.findById(clientId)?.isOnline) {
            return {
                success: false,
                errorCode: "CLIENT_NOT_FOUND",
                errorMessage: new ClientNotFoundError(clientId).message,
            };
        }
        if (!this.treeRepo.find(clientId, treeId)) {
            return {
                success: false,
                errorCode: "TREE_NOT_FOUND",
                errorMessage: new TreeNotFoundError(clientId, treeId).message,
            };
        }

        const correlationId = Math.random().toString(36).substring(2, 10);

        return new Promise<CommandDispatchResult>((resolve) => {
            let settled = false;
            const settle = () => { settled = true; clearTimeout(timeout); unsub(); };

            const unsub = this.agentGateway.onCommandAck((ack) => {
                if (!settled && ack.correlationId === correlationId) {
                    settle();
                    if (ack.success) {
                        resolve({ success: true });
                    } else {
                        resolve({
                            success: false,
                            errorCode: ack.errorCode ?? "COMMAND_REJECTED",
                            errorMessage: ack.errorMessage ?? ack.error ?? "Command failed",
                        });
                    }
                }
            });

            const timeout = setTimeout(() => {
                if (!settled) {
                    settle();
                    resolve({
                        success: false,
                        errorCode: "COMMAND_TIMEOUT",
                        errorMessage: "Command timed out",
                    });
                }
            }, 5000);

            this.agentGateway.sendCommand(clientId, correlationId, command, treeId).catch((err) => {
                if (!settled) {
                    settle();
                    resolve({
                        success: false,
                        errorCode: "COMMAND_DISPATCH_FAILED",
                        errorMessage: err instanceof Error ? err.message : String(err),
                    });
                }
            });
        });
    }
}
