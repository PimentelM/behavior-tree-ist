export interface ClientRecord {
  clientId: string
  firstSeenAt: string
  lastSeenAt: string
}

export interface SessionRecord {
  clientId: string
  sessionId: string
  startedAt: string
  lastSeenAt: string
}

export interface TreeRecord {
  clientId: string
  sessionId: string
  treeId: string
  serializedTreeJson: string
  removedAt: string | null
  updatedAt: string
}

export interface TickRecord {
  clientId: string
  sessionId: string
  treeId: string
  tickId: number
  timestamp: number
  payloadJson: string
}

export interface ServerSettingsRecord {
  id: 1
  maxTicksPerTree: number
  commandTimeoutMs: number
  updatedAt: string
}

export interface ClientRepository {
  upsertClient(record: ClientRecord): Promise<void>
  listClients(): Promise<ClientRecord[]>
}

export interface SessionRepository {
  upsertSession(record: SessionRecord): Promise<void>
  listSessions(clientId: string): Promise<SessionRecord[]>
}

export interface TreeRepository {
  upsertTree(record: TreeRecord): Promise<void>
  markRemoved(clientId: string, sessionId: string, treeId: string, removedAt: string): Promise<void>
  listTrees(clientId: string, sessionId: string): Promise<TreeRecord[]>
}

export interface TickRepository {
  appendBatch(ticks: TickRecord[]): Promise<void>
  listTicks(params: {
    clientId: string
    sessionId: string
    treeId: string
    afterTickId?: number
    limit: number
  }): Promise<TickRecord[]>
  pruneOldTicks(params: {
    clientId: string
    sessionId: string
    treeId: string
    keepLast: number
  }): Promise<number>
}

export interface SettingsRepository {
  getSettings(): Promise<ServerSettingsRecord>
  saveSettings(record: ServerSettingsRecord): Promise<void>
}
