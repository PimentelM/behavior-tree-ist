import { TickRecord, SerializableNode } from "@behavior-tree-ist/core";
import { Client, StoredTree, ServerSettings } from "./types";
import { CommandAckMessage } from "@behavior-tree-ist/studio-transport";

export type Unsubscribe = () => void;
export type CommandAckPayload = CommandAckMessage['payload'];

export interface ClientRepository {
    upsert(client: Client): void;
    findById(clientId: string): Client | undefined;
    findAll(): Client[];
    delete(clientId: string): void;
    setOnline(clientId: string, isOnline: boolean, timestamp: number): void;
}

export interface TreeRepository {
    upsert(clientId: string, treeId: string, serializedTree: SerializableNode, hash: string): StoredTree;
    find(clientId: string, treeId: string): StoredTree | undefined;
    findByClient(clientId: string): StoredTree[];
    delete(clientId: string, treeId: string): void;
    deleteByClient(clientId: string): void;
}

export interface TickRepository {
    push(clientId: string, treeId: string, records: TickRecord[]): void;
    query(clientId: string, treeId: string, afterTickId?: number, limit?: number): TickRecord[];
    clearByTree(clientId: string, treeId: string): void;
    clearByClient(clientId: string): void;
}

export interface SettingsRepository {
    get(): ServerSettings;
    update(settings: Partial<ServerSettings>): ServerSettings;
}

export interface AgentGateway {
    sendCommand(clientId: string, correlationId: string, command: string, treeId: string): Promise<void>;
    onCommandAck(handler: (ack: CommandAckPayload) => void): Unsubscribe;
}
