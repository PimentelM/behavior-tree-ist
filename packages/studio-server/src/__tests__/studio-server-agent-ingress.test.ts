import { mkdtemp, rm } from 'node:fs/promises'
import { createConnection, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import { MessageType } from '@behavior-tree-ist/core'
import WebSocket from 'ws'
import { afterEach, describe, expect, it } from 'vitest'
import { encodeStringFrame } from '../infra/agent-ingress/tcp-length-framing'
import { createStudioServer, type StudioServerHandle } from '../index'

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const waitFor = async (
  condition: () => boolean,
  timeoutMs = 2_000,
  pollIntervalMs = 20,
): Promise<void> => {
  const startedAt = Date.now()
  while (!condition()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for condition.`)
    }
    await wait(pollIntervalMs)
  }
}

const connectWebSocket = async (url: string): Promise<WebSocket> =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url)

    const onError = (error: Error) => {
      socket.off('open', onOpen)
      reject(error)
    }

    const onOpen = () => {
      socket.off('error', onError)
      resolve(socket)
    }

    socket.once('error', onError)
    socket.once('open', onOpen)
  })

const waitForWebSocketClose = async (socket: WebSocket): Promise<void> => {
  if (socket.readyState === WebSocket.CLOSED) {
    return
  }

  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
  })
}

const connectTcpSocket = async (host: string, port: number): Promise<Socket> =>
  new Promise<Socket>((resolve, reject) => {
    const socket = createConnection({ host, port })

    const onError = (error: Error) => {
      socket.off('connect', onConnect)
      reject(error)
    }

    const onConnect = () => {
      socket.off('error', onError)
      resolve(socket)
    }

    socket.once('error', onError)
    socket.once('connect', onConnect)
  })

const waitForSocketClose = async (socket: Socket): Promise<void> => {
  if (socket.destroyed) {
    return
  }

  await new Promise<void>((resolve) => {
    socket.once('close', () => resolve())
  })
}

const sendTcpMessage = (socket: Socket, payload: unknown): void => {
  const jsonPayload = JSON.stringify(payload)
  socket.write(encodeStringFrame(jsonPayload))
}

describe('studio-server agent ingress', () => {
  const servers: StudioServerHandle[] = []
  const tempDirectories: string[] = []

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop()
      if (server !== undefined) {
        await server.stop()
      }
    }

    while (tempDirectories.length > 0) {
      const directory = tempDirectories.pop()
      if (directory !== undefined) {
        await rm(directory, { recursive: true, force: true })
      }
    }
  })

  it('persists hello + catalog changes sent by a websocket agent', async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'studio-server-ws-'))
    tempDirectories.push(tempDirectory)
    const sqlitePath = join(tempDirectory, 'studio.sqlite')

    const server = createStudioServer({
      httpHost: '127.0.0.1',
      httpPort: 0,
      tcpHost: '127.0.0.1',
      tcpPort: 0,
      sqlitePath,
      logLevel: 'silent',
    })
    servers.push(server)
    await server.start()

    const runtime = server.getRuntimeState()
    const wsAgent = await connectWebSocket(
      `ws://${runtime.listeners.http.host}:${runtime.listeners.http.port}/v1/agents/ws`,
    )

    wsAgent.send(
      JSON.stringify({
        t: MessageType.Hello,
        version: 1,
        clientId: 'client-a',
        sessionId: 'session-a',
      }),
    )
    wsAgent.send(
      JSON.stringify({
        t: MessageType.TreeRegistered,
        treeId: 'tree-1',
        serializedTree: { id: 'root' },
      }),
    )
    wsAgent.send(
      JSON.stringify({
        t: MessageType.TreeRemoved,
        treeId: 'tree-1',
      }),
    )

    const database = new BetterSqlite3(sqlitePath)
    await waitFor(() => {
      const client = database
        .prepare('SELECT client_id FROM clients WHERE client_id = ?')
        .get('client-a') as { client_id: string } | undefined
      const session = database
        .prepare(
          'SELECT session_id FROM sessions WHERE client_id = ? AND session_id = ?',
        )
        .get('client-a', 'session-a') as { session_id: string } | undefined
      const tree = database
        .prepare(
          'SELECT removed_at FROM trees WHERE client_id = ? AND session_id = ? AND tree_id = ?',
        )
        .get('client-a', 'session-a', 'tree-1') as { removed_at: string | null } | undefined

      return client !== undefined && session !== undefined && tree?.removed_at !== null
    })

    const persistedClient = database
      .prepare('SELECT client_id FROM clients WHERE client_id = ?')
      .get('client-a') as { client_id: string } | undefined
    const persistedSession = database
      .prepare(
        'SELECT session_id FROM sessions WHERE client_id = ? AND session_id = ?',
      )
      .get('client-a', 'session-a') as { session_id: string } | undefined
    const persistedTree = database
      .prepare(
        'SELECT tree_id, removed_at FROM trees WHERE client_id = ? AND session_id = ? AND tree_id = ?',
      )
      .get('client-a', 'session-a', 'tree-1') as
      | { tree_id: string; removed_at: string | null }
      | undefined

    expect(persistedClient?.client_id).toBe('client-a')
    expect(persistedSession?.session_id).toBe('session-a')
    expect(persistedTree?.tree_id).toBe('tree-1')
    expect(persistedTree?.removed_at).not.toBeNull()
    database.close()

    wsAgent.close()
    await waitForWebSocketClose(wsAgent)
  })

  it('persists hello + catalog changes sent by a TCP agent', async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), 'studio-server-tcp-'))
    tempDirectories.push(tempDirectory)
    const sqlitePath = join(tempDirectory, 'studio.sqlite')

    const server = createStudioServer({
      httpHost: '127.0.0.1',
      httpPort: 0,
      tcpHost: '127.0.0.1',
      tcpPort: 0,
      sqlitePath,
      logLevel: 'silent',
    })
    servers.push(server)
    await server.start()

    const runtime = server.getRuntimeState()
    const tcpAgent = await connectTcpSocket(
      runtime.listeners.tcp.host,
      runtime.listeners.tcp.port ?? 0,
    )

    sendTcpMessage(tcpAgent, {
      t: MessageType.Hello,
      version: 1,
      clientId: 'client-b',
      sessionId: 'session-b',
    })
    sendTcpMessage(tcpAgent, {
      t: MessageType.TreeRegistered,
      treeId: 'tree-9',
      serializedTree: { id: 'root' },
    })

    const database = new BetterSqlite3(sqlitePath)
    await waitFor(() => {
      const tree = database
        .prepare(
          'SELECT tree_id, removed_at FROM trees WHERE client_id = ? AND session_id = ? AND tree_id = ?',
        )
        .get('client-b', 'session-b', 'tree-9') as
        | { tree_id: string; removed_at: string | null }
        | undefined

      return tree !== undefined && tree.removed_at === null
    })

    const persistedTree = database
      .prepare(
        'SELECT tree_id, removed_at FROM trees WHERE client_id = ? AND session_id = ? AND tree_id = ?',
      )
      .get('client-b', 'session-b', 'tree-9') as
      | { tree_id: string; removed_at: string | null }
      | undefined

    expect(persistedTree?.tree_id).toBe('tree-9')
    expect(persistedTree?.removed_at).toBeNull()
    database.close()

    tcpAgent.end()
    await waitForSocketClose(tcpAgent)
  })

  it('replaces the old connection when a duplicate identity connects', async () => {
    const server = createStudioServer({
      httpHost: '127.0.0.1',
      httpPort: 0,
      tcpHost: '127.0.0.1',
      tcpPort: 0,
      sqlitePath: ':memory:',
      logLevel: 'silent',
    })
    servers.push(server)
    await server.start()

    const runtime = server.getRuntimeState()
    const wsAgentA = await connectWebSocket(
      `ws://${runtime.listeners.http.host}:${runtime.listeners.http.port}/v1/agents/ws`,
    )

    wsAgentA.send(
      JSON.stringify({
        t: MessageType.Hello,
        version: 1,
        clientId: 'same-client',
        sessionId: 'same-session',
      }),
    )

    const tcpAgent = await connectTcpSocket(
      runtime.listeners.tcp.host,
      runtime.listeners.tcp.port ?? 0,
    )
    sendTcpMessage(tcpAgent, {
      t: MessageType.Hello,
      version: 1,
      clientId: 'same-client',
      sessionId: 'same-session',
    })

    await waitForWebSocketClose(wsAgentA)
    expect(wsAgentA.readyState).toBe(WebSocket.CLOSED)

    const wsAgentB = await connectWebSocket(
      `ws://${runtime.listeners.http.host}:${runtime.listeners.http.port}/v1/agents/ws`,
    )
    wsAgentB.send(
      JSON.stringify({
        t: MessageType.Hello,
        version: 1,
        clientId: 'same-client',
        sessionId: 'same-session',
      }),
    )

    await waitForSocketClose(tcpAgent)
    expect(tcpAgent.destroyed).toBe(true)

    wsAgentB.close()
    await waitForWebSocketClose(wsAgentB)
  })
})
