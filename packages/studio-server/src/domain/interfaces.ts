import { SerializableNode, TickRecord } from '@bt-studio/core';
import type { ClientRecord, SessionRecord, TreeRecord, SettingsRecord } from './records';

// ── Repository interfaces ──

export interface ClientRepositoryInterface {
    findById(clientId: string): Promise<ClientRecord | undefined>;
    upsert(clientId: string): Promise<void>;
    findAll(): Promise<ClientRecord[]>;
    updateLastSeen(clientId: string): Promise<void>;
}

export interface SessionRepositoryInterface {
    findByClientId(clientId: string): Promise<SessionRecord[]>;
    upsert(clientId: string, sessionId: string): Promise<void>;
    findById(clientId: string, sessionId: string): Promise<SessionRecord | undefined>;
    updateLastSeen(clientId: string, sessionId: string): Promise<void>;
}

export interface TreeRepositoryInterface {
    findBySession(clientId: string, sessionId: string): Promise<TreeRecord[]>;
    upsert(clientId: string, sessionId: string, treeId: string, serializedTree: SerializableNode): Promise<void>;
    markRemoved(clientId: string, sessionId: string, treeId: string): Promise<void>;
    findById(clientId: string, sessionId: string, treeId: string): Promise<TreeRecord | undefined>;
}

export interface TickRepositoryInterface {
    insertBatch(clientId: string, sessionId: string, treeId: string, ticks: TickRecord[]): Promise<void>;
    findAfter(clientId: string, sessionId: string, treeId: string, afterTickId: number, limit: number): Promise<TickRecord[]>;
    pruneToLimit(clientId: string, sessionId: string, treeId: string, maxTicks: number): Promise<void>;
}

export interface SettingsRepositoryInterface {
    get(): Promise<SettingsRecord>;
    update(settings: Partial<Pick<SettingsRecord, 'maxTicksPerTree' | 'commandTimeoutMs'>>): Promise<void>;
}
