import { type SerializableNode, type TickRecord } from "../base";
import { type OffFunction } from "../types";
import { type CommandResponse, type CorrelationId, type StudioCommand } from "./types";

export interface PluginSender {
    send(correlationId: string, payload: unknown): void;
}

export interface StudioPlugin {
    readonly pluginId: string;
    /** Called when agent receives a PluginMessage addressed to this plugin */
    handleInbound(correlationId: string, payload: unknown): Promise<void> | void;
    /** Called once so the plugin can send outbound messages via the agent */
    attach(send: PluginSender): void;
    detach(): void;
}

export interface StudioLinkInterface {
    // Outbound
    sendHello(clientId: string, sessionId: string): void;
    sendTreeRegistered(treeId: string, serializedTree: SerializableNode): void;
    sendTreeRemoved(treeId: string): void;
    sendTickBatch(treeId: string, ticks: TickRecord[]): void;
    sendCommandResponse(correlationId: CorrelationId, response: CommandResponse): void;
    sendPluginMessage(pluginId: string, correlationId: string, payload: unknown): void;

    // Inbound
    onCommand(handler: (command: StudioCommand) => void): OffFunction;
    onPluginMessage(handler: (pluginId: string, correlationId: string, payload: unknown) => void): OffFunction;
    onConnected(handler: () => void): OffFunction;
    onDisconnected(handler: () => void): OffFunction;
    onError(handler: (error: Error) => void): OffFunction;

    // Lifecycle
    open(): void;
    close(): void;
    tick(): void;
    readonly isConnected: boolean;
}
