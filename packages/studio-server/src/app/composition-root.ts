import type { StudioServerOptions } from '../config'
import { resolveStudioServerConfig } from '../config'
import { createFastifyInstance } from '../infra/http/create-fastify-instance'
import type { StudioServerHandle } from '../studio-server-handle'
import { registerV1Routes } from './http/register-v1-routes'
import { StudioServerService } from './studio-server-service'

export function composeStudioServer(options: StudioServerOptions): StudioServerHandle {
  const config = resolveStudioServerConfig(options)
  const server = createFastifyInstance(config.logLevel)
  const service = new StudioServerService(config, server)

  registerV1Routes(server, service)

  return service
}
