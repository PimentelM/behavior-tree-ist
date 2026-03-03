import type { StudioServerOptions } from '../config'
import { resolveStudioServerConfig } from '../config'
import { AgentMessageHandler } from './agent-ingress/agent-message-handler'
import { AgentCatalogService } from '../domain/services/agent-catalog-service'
import {
  createFastifyInstance,
  createSqliteCatalogPersistence,
  InMemoryAgentConnectionRegistry,
  TcpAgentServer,
  WsAgentServer,
} from '../infra'
import type { StudioServerHandle } from '../studio-server-handle'
import { registerV1Routes } from './http/register-v1-routes'
import { StudioServerService } from './studio-server-service'

export function composeStudioServer(options: StudioServerOptions): StudioServerHandle {
  const config = resolveStudioServerConfig(options)
  const server = createFastifyInstance(config.logLevel)
  const persistence = createSqliteCatalogPersistence(config.sqlitePath)
  const connectionRegistry = new InMemoryAgentConnectionRegistry()
  const catalogService = new AgentCatalogService({
    clientRepository: persistence.clients,
    sessionRepository: persistence.sessions,
    treeRepository: persistence.trees,
    connectionRegistry,
  })
  const messageHandler = new AgentMessageHandler({
    catalogService,
    logger: server.log,
  })
  const wsAgentServer = new WsAgentServer({
    onMessage: (connection, payload) => messageHandler.handleMessage(connection, payload),
    onClose: (connection) => messageHandler.handleConnectionClosed(connection),
    logger: server.log,
  })
  const tcpAgentServer = new TcpAgentServer({
    onMessage: (connection, payload) => messageHandler.handleMessage(connection, payload),
    onClose: (connection) => messageHandler.handleConnectionClosed(connection),
    logger: server.log,
  })
  const service = new StudioServerService(
    config,
    server,
    wsAgentServer,
    tcpAgentServer,
  )

  registerV1Routes(server, service)

  return service
}
