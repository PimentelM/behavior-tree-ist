import type {
    ClientRecord,
    SessionRecord,
    TreeRecord,
    SettingsRecord,
} from '../../domain/records';
import type { TickRecord } from '@behavior-tree-ist/core';
import type {
    DbClient,
    DbSession,
    DbTree,
    DbTick,
    DbSettings,
} from './schemas';
import { SerializableNodeSchema, TickRecordSchema } from '../../domain/bt-core-types';

export function mapDbClientToDomain(dbClient: DbClient): ClientRecord {
    return dbClient;
}

export function mapClientToDb(client: ClientRecord): DbClient {
    return client;
}

export function mapDbSessionToDomain(dbSession: DbSession): SessionRecord {
    return dbSession;
}

export function mapSessionToDb(session: SessionRecord): DbSession {
    return session;
}

export function mapDbTreeToDomain(dbTree: DbTree): TreeRecord {
    return {
        clientId: dbTree.clientId,
        sessionId: dbTree.sessionId,
        treeId: dbTree.treeId,
        serializedTree: SerializableNodeSchema.parse(parseJson(dbTree.serializedTreeJson, 'tree payload')),
        removedAt: dbTree.removedAt ?? undefined,
        updatedAt: dbTree.updatedAt,
    };
}

export function mapTreeToDb(tree: TreeRecord): DbTree {
    return {
        clientId: tree.clientId,
        sessionId: tree.sessionId,
        treeId: tree.treeId,
        serializedTreeJson: JSON.stringify(tree.serializedTree),
        removedAt: tree.removedAt ?? null,
        updatedAt: tree.updatedAt,
    };
}

export function mapDbTickToDomain(dbTick: DbTick): TickRecord {
    return TickRecordSchema.parse(parseJson(dbTick.payloadJson, 'tick payload'));
}

export function mapTickToDb(params: {
    clientId: string;
    sessionId: string;
    treeId: string;
    tick: TickRecord;
}): DbTick {
    return {
        clientId: params.clientId,
        sessionId: params.sessionId,
        treeId: params.treeId,
        tickId: params.tick.tickId,
        timestamp: params.tick.timestamp,
        payloadJson: JSON.stringify(params.tick),
    };
}

export function mapDbSettingsToDomain(dbSettings: DbSettings): SettingsRecord {
    return dbSettings;
}

export function mapSettingsToDb(settings: SettingsRecord): DbSettings {
    return settings;
}

function parseJson(raw: string, label: string): unknown {
    try {
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Invalid ${label} JSON: ${String(error)}`);
    }
}
