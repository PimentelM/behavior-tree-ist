import { CommandResponse, StudioCommand } from '@behavior-tree-ist/core';
import { AgentConnection } from './types';

// ── Repository interfaces ──

export interface ClientRow {
    client_id: string;
    first_seen_at: number;
    last_seen_at: number;
}

export interface ClientRepositoryInterface {
    findById(clientId: string): Promise<ClientRow | undefined>;
    upsert(clientId: string): Promise<void>;
    findAll(): Promise<ClientRow[]>;
    updateLastSeen(clientId: string): Promise<void>;
}

export interface SessionRow {
    client_id: string;
    session_id: string;
    started_at: number;
    last_seen_at: number;
}

export interface SessionRepositoryInterface {
    findByClientId(clientId: string): Promise<SessionRow[]>;
    upsert(clientId: string, sessionId: string): Promise<void>;
    findById(clientId: string, sessionId: string): Promise<SessionRow | undefined>;
    updateLastSeen(clientId: string, sessionId: string): Promise<void>;
}

export interface TreeRow {
    client_id: string;
    session_id: string;
    tree_id: string;
    serialized_tree_json: string;
    removed_at: number | null;
    updated_at: number;
}

export interface TreeRepositoryInterface {
    findBySession(clientId: string, sessionId: string): Promise<TreeRow[]>;
    upsert(clientId: string, sessionId: string, treeId: string, serializedTreeJson: string): Promise<void>;
    markRemoved(clientId: string, sessionId: string, treeId: string): Promise<void>;
    findById(clientId: string, sessionId: string, treeId: string): Promise<TreeRow | undefined>;
}

export interface TickRow {
    client_id: string;
    session_id: string;
    tree_id: string;
    tick_id: number;
    timestamp: number;
    payload_json: string;
}

export interface TickRepositoryInterface {
    insertBatch(clientId: string, sessionId: string, treeId: string, ticks: Array<{ tickId: number; timestamp: number; payloadJson: string }>): Promise<void>;
    findAfter(clientId: string, sessionId: string, treeId: string, afterTickId: number, limit: number): Promise<TickRow[]>;
    pruneToLimit(clientId: string, sessionId: string, treeId: string, maxTicks: number): Promise<void>;
}

export interface SettingsRow {
    id: number;
    max_ticks_per_tree: number;
    command_timeout_ms: number;
    updated_at: number;
}

export interface SettingsRepositoryInterface {
    get(): Promise<SettingsRow>;
    update(settings: Partial<Pick<SettingsRow, 'max_ticks_per_tree' | 'command_timeout_ms'>>): Promise<void>;
}

// ── Service interfaces ──

export interface AgentConnectionRegistryInterface {
    register(wsClientId: string, clientId: string, sessionId: string): void;
    unregisterByWsClientId(wsClientId: string): AgentConnection | undefined;
    getByIdentity(clientId: string, sessionId: string): AgentConnection | undefined;
    getAllConnections(): AgentConnection[];
    isOnline(clientId: string, sessionId: string): boolean;
}

export interface CommandBrokerInterface {
    sendCommand(wsClientId: string, command: StudioCommand): Promise<CommandResponse>;
    handleResponse(correlationId: string, response: CommandResponse): void;
}
