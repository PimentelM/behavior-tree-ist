declare module 'knex/types/tables' {
    interface Tables {
        clients: DbClient;
        sessions: DbSession;
        trees: DbTree;
        ticks: DbTick;
        serverSettings: DbSettings;
    }
}

export interface DbClient {
    clientId: string;
    firstSeenAt: number;
    lastSeenAt: number;
}

export interface DbSession {
    clientId: string;
    sessionId: string;
    startedAt: number;
    lastSeenAt: number;
}

export interface DbTree {
    clientId: string;
    sessionId: string;
    treeId: string;
    serializedTreeJson: string;
    removedAt: number | null;
    updatedAt: number;
}

export interface DbTick {
    clientId: string;
    sessionId: string;
    treeId: string;
    tickId: number;
    timestamp: number;
    payloadJson: string;
}

export interface DbSettings {
    id: number;
    maxTicksPerTree: number;
    commandTimeoutMs: number;
    updatedAt: number;
}
