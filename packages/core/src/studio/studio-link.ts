import { SerializableNode, TickRecord } from "../base";
import { TreeId } from "../registry";
import { OffFunction } from "../types";
import { StudioCommandType, TreeStatuses } from "./types";

export type CorrelationId = string;
export interface StudioCommand {
    correlationId: CorrelationId;
    treeId: TreeId;
    command: StudioCommandType;
}

export interface StudioLink {
    // Outbound
    sendHello(clientId: string, sessionId: string): void;
    sendTreeRegistered(treeId: string, serializedTree: SerializableNode): void;
    sendTreeRemoved(treeId: string): void;
    sendTickBatch(treeId: string, ticks: TickRecord[]): void;
    sendTreeStatuses(treeId: string, statuses: TreeStatuses): void;
    sendCommandAck(correlationId: string, success: true): void;
    sendCommandAck(correlationId: string, success: false, errorCode: string, errorMessage: string): void;

    // Inbound
    onCommand(handler: (command: StudioCommand) => void): OffFunction;
    onConnected(handler: () => void): OffFunction;
    onDisconnected(handler: () => void): OffFunction;

    // Lifecycle
    open(): void;
    close(): void;
    readonly isConnected: boolean;
}
