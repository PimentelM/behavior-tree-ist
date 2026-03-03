import BetterSqlite3 from 'better-sqlite3'
import type {
  ClientRecord,
  ClientRepository,
  SessionRecord,
  SessionRepository,
  TreeRecord,
  TreeRepository,
} from '../../../domain'

interface ClientRow {
  client_id: string
  first_seen_at: string
  last_seen_at: string
}

interface SessionRow {
  client_id: string
  session_id: string
  started_at: string
  last_seen_at: string
}

interface TreeRow {
  client_id: string
  session_id: string
  tree_id: string
  serialized_tree_json: string
  removed_at: string | null
  updated_at: string
}

export interface SqliteCatalogPersistence {
  readonly clients: ClientRepository
  readonly sessions: SessionRepository
  readonly trees: TreeRepository
  close(): void
}

const createSchema = (database: BetterSqlite3.Database): void => {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS clients (
      client_id TEXT PRIMARY KEY,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      client_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (client_id, session_id),
      FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trees (
      client_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      tree_id TEXT NOT NULL,
      serialized_tree_json TEXT NOT NULL,
      removed_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (client_id, session_id, tree_id),
      FOREIGN KEY (client_id, session_id)
        REFERENCES sessions(client_id, session_id)
        ON DELETE CASCADE
    );
  `)
}

class SqliteCatalogRepository
  implements ClientRepository, SessionRepository, TreeRepository {
  private readonly upsertClientStatement = this.database.prepare(`
    INSERT INTO clients (client_id, first_seen_at, last_seen_at)
    VALUES (@clientId, @firstSeenAt, @lastSeenAt)
    ON CONFLICT(client_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `)

  private readonly listClientsStatement = this.database.prepare(`
    SELECT client_id, first_seen_at, last_seen_at
    FROM clients
    ORDER BY client_id ASC
  `)

  private readonly upsertSessionStatement = this.database.prepare(`
    INSERT INTO sessions (client_id, session_id, started_at, last_seen_at)
    VALUES (@clientId, @sessionId, @startedAt, @lastSeenAt)
    ON CONFLICT(client_id, session_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `)

  private readonly listSessionsStatement = this.database.prepare(`
    SELECT client_id, session_id, started_at, last_seen_at
    FROM sessions
    WHERE client_id = ?
    ORDER BY started_at DESC, session_id ASC
  `)

  private readonly upsertTreeStatement = this.database.prepare(`
    INSERT INTO trees (
      client_id,
      session_id,
      tree_id,
      serialized_tree_json,
      removed_at,
      updated_at
    )
    VALUES (
      @clientId,
      @sessionId,
      @treeId,
      @serializedTreeJson,
      @removedAt,
      @updatedAt
    )
    ON CONFLICT(client_id, session_id, tree_id) DO UPDATE SET
      serialized_tree_json = excluded.serialized_tree_json,
      removed_at = NULL,
      updated_at = excluded.updated_at
  `)

  private readonly markTreeRemovedStatement = this.database.prepare(`
    UPDATE trees
    SET removed_at = ?, updated_at = ?
    WHERE client_id = ? AND session_id = ? AND tree_id = ?
  `)

  private readonly listTreesStatement = this.database.prepare(`
    SELECT
      client_id,
      session_id,
      tree_id,
      serialized_tree_json,
      removed_at,
      updated_at
    FROM trees
    WHERE client_id = ? AND session_id = ?
    ORDER BY tree_id ASC
  `)

  constructor(private readonly database: BetterSqlite3.Database) {}

  async upsertClient(record: ClientRecord): Promise<void> {
    this.upsertClientStatement.run(record)
  }

  async listClients(): Promise<ClientRecord[]> {
    const rows = this.listClientsStatement.all() as ClientRow[]
    return rows.map((row) => ({
      clientId: row.client_id,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    }))
  }

  async upsertSession(record: SessionRecord): Promise<void> {
    this.upsertSessionStatement.run(record)
  }

  async listSessions(clientId: string): Promise<SessionRecord[]> {
    const rows = this.listSessionsStatement.all(clientId) as SessionRow[]
    return rows.map((row) => ({
      clientId: row.client_id,
      sessionId: row.session_id,
      startedAt: row.started_at,
      lastSeenAt: row.last_seen_at,
    }))
  }

  async upsertTree(record: TreeRecord): Promise<void> {
    this.upsertTreeStatement.run(record)
  }

  async markRemoved(
    clientId: string,
    sessionId: string,
    treeId: string,
    removedAt: string,
  ): Promise<void> {
    this.markTreeRemovedStatement.run(removedAt, removedAt, clientId, sessionId, treeId)
  }

  async listTrees(clientId: string, sessionId: string): Promise<TreeRecord[]> {
    const rows = this.listTreesStatement.all(clientId, sessionId) as TreeRow[]
    return rows.map((row) => ({
      clientId: row.client_id,
      sessionId: row.session_id,
      treeId: row.tree_id,
      serializedTreeJson: row.serialized_tree_json,
      removedAt: row.removed_at,
      updatedAt: row.updated_at,
    }))
  }
}

export const createSqliteCatalogPersistence = (sqlitePath: string): SqliteCatalogPersistence => {
  const database = new BetterSqlite3(sqlitePath)
  createSchema(database)
  const repository = new SqliteCatalogRepository(database)

  return {
    clients: repository,
    sessions: repository,
    trees: repository,
    close: () => database.close(),
  }
}
