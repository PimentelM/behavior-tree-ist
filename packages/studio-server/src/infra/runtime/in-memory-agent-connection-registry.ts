import type { AgentConnection, AgentConnectionRegistry, AgentIdentity } from '../../domain'

const identityToKey = ({ clientId, sessionId }: AgentIdentity): string =>
  `${clientId}\u0000${sessionId}`

export class InMemoryAgentConnectionRegistry implements AgentConnectionRegistry {
  private readonly onlineConnections = new Map<string, AgentConnection>()

  async setOnline(
    identity: AgentIdentity,
    connection: AgentConnection,
  ): Promise<AgentConnection | null> {
    const key = identityToKey(identity)
    const previousConnection = this.onlineConnections.get(key) ?? null
    this.onlineConnections.set(key, connection)
    return previousConnection
  }

  async setOffline(identity: AgentIdentity): Promise<void> {
    this.onlineConnections.delete(identityToKey(identity))
  }

  async getConnection(identity: AgentIdentity): Promise<AgentConnection | null> {
    return this.onlineConnections.get(identityToKey(identity)) ?? null
  }

  async isOnline(identity: AgentIdentity): Promise<boolean> {
    return this.onlineConnections.has(identityToKey(identity))
  }
}
