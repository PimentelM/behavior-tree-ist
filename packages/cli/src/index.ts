import { defineCommand, runMain } from 'citty'
import { createStudioServer } from '@bt-studio/studio-server'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { startDemoAgent } from './demo-agent.js'

function resolveUiDistPath(): string {
  const require = createRequire(import.meta.url)
  const uiPkgJson = require.resolve('@bt-studio/studio-ui/package.json')
  const distPath = join(dirname(uiPkgJson), 'dist')
  if (!existsSync(distPath)) {
    throw new Error(`UI dist not found at ${distPath}. Run 'yarn build' first.`)
  }
  return distPath
}

const main = defineCommand({
  meta: {
    name: 'bt-studio',
    description: 'Behavior Tree Studio — start server + UI',
  },
  args: {
    port: {
      type: 'string',
      description: 'HTTP port',
      default: '4100',
    },
    host: {
      type: 'string',
      description: 'HTTP host',
      default: '0.0.0.0',
    },
    demo: {
      type: 'boolean',
      description: 'Run NPC demo agent (default demo)',
      default: false,
    },
    'demo-cpu': {
      type: 'boolean',
      description: 'Run CPU-heavy demo agent',
      default: false,
    },
    db: {
      type: 'string',
      description: 'SQLite database path',
      default: join(homedir(), '.bt-studio', 'db.sql'),
    },
  },
  async run({ args }) {
    const port = parseInt(args.port, 10)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port: ${args.port}. Must be an integer between 1 and 65535.`)
    }
    const dbPath = resolve(args.db)
    mkdirSync(dirname(dbPath), { recursive: true })

    const staticDir = resolveUiDistPath()

    const server = createStudioServer({
      httpHost: args.host,
      httpPort: port,
      sqlitePath: dbPath,
      staticDir,
    })

    await server.start()
    const displayHost = args.host === '0.0.0.0' ? 'localhost' : args.host
    console.log(`BT Studio running at http://${displayHost}:${port}`)

    let npcHandle: { shutdown(): void } | undefined
    let cpuHandle: { shutdown(): void } | undefined

    if (args.demo) {
      npcHandle = startDemoAgent(`ws://${displayHost}:${port}/ws`, 'npc')
      console.log('NPC demo agent started')
    }

    if (args['demo-cpu']) {
      cpuHandle = startDemoAgent(`ws://${displayHost}:${port}/ws`, 'cpu')
      console.log('CPU demo agent started')
    }

    const shutdown = async () => {
      console.log('\nShutting down...')
      npcHandle?.shutdown()
      cpuHandle?.shutdown()
      await server.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  },
})

runMain(main)
