export interface AgentIdentity {
  clientId: string
  sessionId: string
}

export interface AgentConnection {
  send(payload: unknown): Promise<void> | void
  close(reason?: string): Promise<void> | void
}

export interface AgentConnectionRegistry {
  setOnline(identity: AgentIdentity, connection: AgentConnection): Promise<AgentConnection | null>
  setOffline(identity: AgentIdentity): Promise<void>
  getConnection(identity: AgentIdentity): Promise<AgentConnection | null>
  isOnline(identity: AgentIdentity): Promise<boolean>
}
