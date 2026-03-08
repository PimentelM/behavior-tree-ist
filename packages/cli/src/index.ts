import { defineCommand, runMain } from 'citty'
import { createStudioServer } from '@bt-studio/studio-server'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { startDemoAgent } from './demo-agent.js'

function resolveUiDistPath(): string {
  const require = createRequire(import.meta.url)
  const uiPkgJson = require.resolve('@bt-studio/studio-ui/package.json')
  return join(dirname(uiPkgJson), 'dist')
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
      description: 'Run a demo agent',
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
    console.log(`BT Studio running at http://localhost:${port}`)

    let demoHandle: { shutdown(): void } | undefined
    if (args.demo) {
      demoHandle = startDemoAgent(`ws://localhost:${port}/ws`)
      console.log('Demo agent started')
    }

    const shutdown = async () => {
      console.log('\nShutting down...')
      demoHandle?.shutdown()
      await server.stop()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  },
})

runMain(main)
