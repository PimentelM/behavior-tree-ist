import type { FastifyInstance } from 'fastify'
import type { StudioRuntimeStateProvider } from '../studio-runtime-state-provider'

export function registerV1Routes(
  server: FastifyInstance,
  runtimeStateProvider: StudioRuntimeStateProvider,
): void {
  server.get('/v1/health', async () => {
    const runtime = runtimeStateProvider.getRuntimeState()

    return {
      status: 'ok',
      runtime: {
        status: runtime.status,
        startedAt: runtime.startedAt,
        listeners: runtime.listeners,
      },
    }
  })
}
