import { type TickRecord } from "../base";
import { type TreeRegistry } from "../registry/tree-registry";
import { type RegisteredTree } from "../registry/types";
import { assertValidId } from "../registry/validation";
import { type OffFunction } from "../types";
import { type PluginSender, type StudioPlugin, type StudioLinkInterface } from "./interfaces";
import { type CommandResponse, type CommandResponseData, type CommandResponseSuccess, type StudioCommand, StudioCommandType, StudioErrorCode } from "./types";

interface AgentManagedTreeState {
    streaming: boolean;
}

/**
 * Captures outbound plugin messages sent synchronously during attach() and replays
 * them on flush() (when the link first connects). After stopBuffering() is called,
 * any send() calls go directly to the delegate — so normal operation is transparent.
 *
 * This solves the timing issue where plugins call send() inside attach() before the
 * WebSocket link is open (StudioLink silently drops messages when not connected).
 */
class PluginMessageBuffer implements PluginSender {
    private buffering = true;
    private buffer: Array<{ correlationId: string; payload: unknown }> = [];

    constructor(private readonly delegate: PluginSender) {}

    send(correlationId: string, payload: unknown): void {
        if (this.buffering) {
            this.buffer.push({ correlationId, payload });
        } else {
            this.delegate.send(correlationId, payload);
        }
    }

    /** Call after attach() returns so subsequent sends go directly to the delegate. */
    stopBuffering(): void {
        this.buffering = false;
    }

    /** Deliver all messages captured during attach() to the delegate. */
    flush(): void {
        const pending = this.buffer;
        this.buffer = [];
        for (const { correlationId, payload } of pending) {
            this.delegate.send(correlationId, payload);
        }
    }
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
    private readonly plugins = new Map<string, StudioPlugin>();
    private readonly pluginBuffers = new Map<string, PluginMessageBuffer>();
    private readonly unsubscribers: OffFunction[] = [];
    private destroyed = false;
    private started = false;

    private defaultStreamingState = false;

    public enableStreamingOnRegisteredTrees() {
        this.defaultStreamingState = true;
        return this;
    }

    public registerPlugin(plugin: StudioPlugin): void {
        if (this.started) throw new Error('Cannot register plugin after agent is started');
        this.plugins.set(plugin.pluginId, plugin);
    }

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
            this.link.onConnected(() => { this.handleConnected(); }),
            this.link.onDisconnected(() => { this.handleDisconnected(); }),
            this.link.onCommand((command) => { this.handleCommand(command); }),
            this.link.onPluginMessage((pluginId, correlationId, payload) => {
                const plugin = this.plugins.get(pluginId);
                if (plugin) void plugin.handleInbound(correlationId, payload);
            }),
        );

        // Attach plugins with buffering senders.
        // Messages sent synchronously inside attach() (e.g. ReplPlugin handshake) are
        // buffered and replayed when the link first connects. Subsequent sends go directly.
        for (const plugin of this.plugins.values()) {
            const delegate: PluginSender = {
                send: (correlationId, payload) => {
                    this.link.sendPluginMessage(plugin.pluginId, correlationId, payload);
                },
            };
            const buffer = new PluginMessageBuffer(delegate);
            this.pluginBuffers.set(plugin.pluginId, buffer);
            plugin.attach(buffer);
            buffer.stopBuffering();
        }

        // Subscribe to registry events
        this.unsubscribers.push(
            this.registry.onTreeRegistered((entry) => { this.handleTreeRegistered(entry); }),
            this.registry.onTreeRemoved((treeId) => { this.handleTreeRemoved(treeId); }),
            this.registry.onTreeTick((treeId, record) => { this.handleTreeTick(treeId, record); }),
        );

        // Initialize state for trees already in the registry
        for (const [treeId] of this.registry.getAll()) {
            this.agentManagedStates.set(treeId, { streaming: this.defaultStreamingState });
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
        for (const plugin of this.plugins.values()) plugin.detach();
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

        // Flush any messages buffered before the first connection, then notify plugins
        for (const plugin of this.plugins.values()) {
            this.pluginBuffers.get(plugin.pluginId)?.flush();
            plugin.onConnected?.();
        }
    }

    private handleDisconnected(): void {
        // No-op: preserve per-tree toggle states across disconnections.
        // Ticks are simply dropped while disconnected.
    }

    private handleTreeRegistered(entry: RegisteredTree): void {
        this.agentManagedStates.set(entry.treeId, { streaming: this.defaultStreamingState });
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
            ? ({ success: true, data } as unknown) as CommandResponseSuccess
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
