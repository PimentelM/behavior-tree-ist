import type { AgentConnection, AgentConnectionRegistry, AgentIdentity } from '../contracts/agent-connection-registry'
import type { ClientRepository, SessionRepository, TreeRepository } from '../contracts/repositories'

const sameIdentity = (left: AgentIdentity, right: AgentIdentity): boolean =>
  left.clientId === right.clientId && left.sessionId === right.sessionId

export interface AgentCatalogServiceOptions {
  clientRepository: ClientRepository
  sessionRepository: SessionRepository
  treeRepository: TreeRepository
  connectionRegistry: AgentConnectionRegistry
  now?: () => string
}

export class AgentCatalogService {
  private readonly identityByConnection = new WeakMap<AgentConnection, AgentIdentity>()
  private readonly now: () => string

  constructor(private readonly options: AgentCatalogServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString())
  }

  async handleHello(
    connection: AgentConnection,
    clientId: string,
    sessionId: string,
  ): Promise<void> {
    const nextIdentity: AgentIdentity = { clientId, sessionId }
    const previousIdentity = this.identityByConnection.get(connection)
    if (previousIdentity !== undefined && !sameIdentity(previousIdentity, nextIdentity)) {
      await this.setOfflineIfCurrent(previousIdentity, connection)
    }

    this.identityByConnection.set(connection, nextIdentity)
    const previousConnection = await this.options.connectionRegistry.setOnline(
      nextIdentity,
      connection,
    )

    if (previousConnection !== null && previousConnection !== connection) {
      await previousConnection.close('superseded-by-new-connection')
    }

    const timestamp = this.now()
    await this.options.clientRepository.upsertClient({
      clientId,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    })
    await this.options.sessionRepository.upsertSession({
      clientId,
      sessionId,
      startedAt: timestamp,
      lastSeenAt: timestamp,
    })
  }

  async handleTreeRegistered(
    connection: AgentConnection,
    treeId: string,
    serializedTree: unknown,
  ): Promise<void> {
    const identity = this.identityByConnection.get(connection)
    if (identity === undefined) {
      return
    }

    await this.options.treeRepository.upsertTree({
      clientId: identity.clientId,
      sessionId: identity.sessionId,
      treeId,
      serializedTreeJson: JSON.stringify(serializedTree),
      removedAt: null,
      updatedAt: this.now(),
    })
  }

  async handleTreeRemoved(connection: AgentConnection, treeId: string): Promise<void> {
    const identity = this.identityByConnection.get(connection)
    if (identity === undefined) {
      return
    }

    await this.options.treeRepository.markRemoved(
      identity.clientId,
      identity.sessionId,
      treeId,
      this.now(),
    )
  }

  async handleConnectionClosed(connection: AgentConnection): Promise<void> {
    const identity = this.identityByConnection.get(connection)
    if (identity === undefined) {
      return
    }

    this.identityByConnection.delete(connection)
    await this.setOfflineIfCurrent(identity, connection)
  }

  private async setOfflineIfCurrent(
    identity: AgentIdentity,
    connection: AgentConnection,
  ): Promise<void> {
    const currentConnection = await this.options.connectionRegistry.getConnection(identity)
    if (currentConnection !== connection) {
      return
    }

    await this.options.connectionRegistry.setOffline(identity)
  }
}
