import { afterEach, describe, expect, it } from 'vitest'
import { createStudioServer, type StudioServerHandle } from '../index'

describe('createStudioServer lifecycle', () => {
  const servers: StudioServerHandle[] = []

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop()
      if (server !== undefined) {
        await server.stop()
      }
    }
  })

  it('starts and stops with a health endpoint', async () => {
    const server = createStudioServer({
      httpHost: '127.0.0.1',
      httpPort: 0,
      logLevel: 'silent',
    })
    servers.push(server)

    expect(server.getRuntimeState().status).toBe('idle')

    await server.start()

    const runtime = server.getRuntimeState()
    expect(runtime.status).toBe('running')
    expect(runtime.listeners.http.listening).toBe(true)
    expect(runtime.listeners.http.port).toBeGreaterThan(0)

    const response = await fetch(
      `http://${runtime.listeners.http.host}:${runtime.listeners.http.port}/v1/health`,
    )

    expect(response.status).toBe(200)

    const payload: unknown = await response.json()
    expect(payload).toMatchObject({ status: 'ok' })

    await server.stop()

    const stopped = server.getRuntimeState()
    expect(stopped.status).toBe('idle')
    expect(stopped.listeners.http.listening).toBe(false)
  })

  it('supports start/stop calls more than once', async () => {
    const server = createStudioServer({
      httpHost: '127.0.0.1',
      httpPort: 0,
      logLevel: 'silent',
    })
    servers.push(server)

    await server.start()
    await server.start()

    expect(server.getRuntimeState().status).toBe('running')

    await server.stop()
    await server.stop()

    expect(server.getRuntimeState().status).toBe('idle')
  })
})
