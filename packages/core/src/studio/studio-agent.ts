import { TickRecord } from "../base";
import { TreeRegistry } from "../registry/tree-registry";
import { RegisteredTree } from "../registry/types";
import { assertValidId } from "../registry/validation";
import { OffFunction } from "../types";
import { StudioLinkInterface } from "./interfaces";
import { CommandResponse, CommandResponseData, CommandResponseSuccess, StudioCommand, StudioCommandType, StudioErrorCode } from "./types";

interface AgentManagedTreeState {
    streaming: boolean;
}

export interface StudioAgentOptions {
    clientId: string;
    sessionId: string;
    registry: TreeRegistry;
    link: StudioLinkInterface;
}

export class StudioAgent {
    private readonly clientId: string;
    private readonly sessionId: string;
    private readonly registry: TreeRegistry;
    private readonly link: StudioLinkInterface;
    private readonly agentManagedStates = new Map<string, AgentManagedTreeState>();
    private readonly unsubscribers: OffFunction[] = [];
    private destroyed = false;
    private started = false;

    constructor(options: StudioAgentOptions) {
        assertValidId(options.clientId, 'clientId');
        assertValidId(options.sessionId, 'sessionId');
        this.clientId = options.clientId;
        this.sessionId = options.sessionId;
        this.registry = options.registry;
        this.link = options.link;
    }

    get isConnected(): boolean {
        return this.link.isConnected;
    }

    start(): void {
        if (this.destroyed) {
            throw new Error('StudioAgent has been destroyed');
        }
        if (this.started) {
            throw new Error('StudioAgent has already been started');
        }
        this.started = true;

        // Subscribe to link events
        this.unsubscribers.push(
            this.link.onConnected(() => this.handleConnected()),
            this.link.onDisconnected(() => this.handleDisconnected()),
            this.link.onCommand((command) => this.handleCommand(command)),
        );

        // Subscribe to registry events
        this.unsubscribers.push(
            this.registry.onTreeRegistered((entry) => this.handleTreeRegistered(entry)),
            this.registry.onTreeRemoved((treeId) => this.handleTreeRemoved(treeId)),
            this.registry.onTreeTick((treeId, record) => this.handleTreeTick(treeId, record)),
        );

        // Initialize state for trees already in the registry
        for (const [treeId] of this.registry.getAll()) {
            this.agentManagedStates.set(treeId, { streaming: false });
        }

        this.link.open();
    }

    tick(): void {
        this.link.tick();
    }

    destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        for (const unsub of this.unsubscribers) {
            unsub();
        }
        this.unsubscribers.length = 0;
        this.agentManagedStates.clear();
        this.link.close();
    }

    private handleConnected(): void {
        this.link.sendHello(this.clientId, this.sessionId);

        for (const [treeId] of this.agentManagedStates) {
            const entry = this.registry.get(treeId);
            if (entry) {
                this.link.sendTreeRegistered(treeId, entry.serializedTree);
            }
        }
    }

    private handleDisconnected(): void {
        // No-op: preserve per-tree toggle states across disconnections.
        // Ticks are simply dropped while disconnected.
    }

    private handleTreeRegistered(entry: RegisteredTree): void {
        this.agentManagedStates.set(entry.treeId, { streaming: false });
        if (this.link.isConnected) {
            this.link.sendTreeRegistered(entry.treeId, entry.serializedTree);
        }
    }

    private handleTreeRemoved(treeId: string): void {
        this.agentManagedStates.delete(treeId);
        if (this.link.isConnected) {
            this.link.sendTreeRemoved(treeId);
        }
    }

    private handleTreeTick(treeId: string, record: TickRecord): void {
        const state = this.agentManagedStates.get(treeId);
        if (state?.streaming && this.link.isConnected) {
            this.link.sendTickBatch(treeId, [record]);
        }
    }

    private getTreeStatuses(treeId: string) {
        const state = this.agentManagedStates.get(treeId);
        const entry = this.registry.get(treeId);
        if (!state || !entry) {
            return null;
        }
        return {
            streaming: state.streaming,
            profiling: entry.tree.isProfilingEnabled,
            stateTrace: entry.tree.isStateTraceEnabled
        };
    }

    private sendSuccess(correlationId: string, data?: CommandResponseData): void {
        const response: CommandResponse = data !== undefined
            ? { success: true, data } as CommandResponseSuccess
            : { success: true };
        this.link.sendCommandResponse(correlationId, response);
    }

    private sendError(correlationId: string, errorCode: StudioErrorCode, errorMessage: string): void {
        this.link.sendCommandResponse(correlationId, {
            success: false, errorCode, errorMessage,
        });
    }

    private handleCommand(command: StudioCommand): void {
        const { correlationId, treeId, command: cmd } = command;

        // Tree-scoped commands
        const state = this.agentManagedStates.get(treeId);
        if (!state) {
            this.sendError(correlationId, StudioErrorCode.TreeNotFound, `Tree "${treeId}" not found`);
            return;
        }

        const entry = this.registry.get(treeId);
        if (!entry) {
            this.sendError(correlationId, StudioErrorCode.TreeNotFound, `Tree "${treeId}" not found`);
            return;
        }

        switch (cmd) {
            case StudioCommandType.EnableStreaming:
                state.streaming = true;
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.DisableStreaming:
                state.streaming = false;
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.EnableStateTrace:
                entry.tree.enableStateTrace();
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.DisableStateTrace:
                entry.tree.disableStateTrace();
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.EnableProfiling:
                entry.tree.enableProfiling();
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.DisableProfiling:
                entry.tree.disableProfiling();
                this.sendSuccess(correlationId);
                break;

            case StudioCommandType.GetTreeStatuses: {
                const statuses = this.getTreeStatuses(treeId);
                if (!statuses) {
                    this.sendError(correlationId, StudioErrorCode.TreeNotFound, `Tree "${treeId}" not found`);
                }
                else {
                    this.sendSuccess(correlationId, statuses);
                }
                break;
            }

            default:
                this.sendError(correlationId, StudioErrorCode.UnknownCommand, `Unknown command "${cmd}"`);
                break;
        }
    }
}
