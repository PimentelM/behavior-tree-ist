import type {
    ClientRecord,
    SessionRecord,
    TreeRecord,
    TickRecord,
    SettingsRecord,
} from '../../domain/records';
import type {
    DbClient,
    DbSession,
    DbTree,
    DbTick,
    DbSettings,
} from './schemas';

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
        serializedTreeJson: dbTree.serializedTreeJson,
        removedAt: dbTree.removedAt ?? undefined,
        updatedAt: dbTree.updatedAt,
    };
}

export function mapTreeToDb(tree: TreeRecord): DbTree {
    return {
        clientId: tree.clientId,
        sessionId: tree.sessionId,
        treeId: tree.treeId,
        serializedTreeJson: tree.serializedTreeJson,
        removedAt: tree.removedAt ?? null,
        updatedAt: tree.updatedAt,
    };
}

export function mapDbTickToDomain(dbTick: DbTick): TickRecord {
    return dbTick;
}

export function mapTickToDb(tick: TickRecord): DbTick {
    return tick;
}

export function mapDbSettingsToDomain(dbSettings: DbSettings): SettingsRecord {
    return dbSettings;
}

export function mapSettingsToDb(settings: SettingsRecord): DbSettings {
    return settings;
}
