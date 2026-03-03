import { SerializableNode, TickRecord } from "../base";
import { OffFunction } from "../types";
import { CommandResponse, CorrelationId, StudioCommand } from "./types";

export interface StudioLink {
    // Outbound
    sendHello(clientId: string, sessionId: string): void;
    sendTreeRegistered(treeId: string, serializedTree: SerializableNode): void;
    sendTreeRemoved(treeId: string): void;
    sendTickBatch(treeId: string, ticks: TickRecord[]): void;
    sendCommandResponse(correlationId: CorrelationId, response: CommandResponse): void;

    // Inbound
    onCommand(handler: (command: StudioCommand) => void): OffFunction;
    onConnected(handler: () => void): OffFunction;
    onDisconnected(handler: () => void): OffFunction;

    // Lifecycle
    open(): void;
    close(): void;
    readonly isConnected: boolean;
}
