import { defineCommand } from 'citty'
import {
  TreeRegistry,
  StudioLink,
  StudioAgent,
} from '@behavior-tree-ist/core'
import { createCpuHeavyTree } from '@behavior-tree-ist/core/demos'
import { WsNodeStringTransport } from '@behavior-tree-ist/studio-transport/node'

export const demoCommand = defineCommand({
  meta: {
    name: 'demo',
    description: 'Run a demo tree that connects to the studio server',
  },
  args: {
    url: {
      type: 'string',
      description: 'WebSocket server URL',
      default: 'ws://localhost:4100/ws',
    },
  },
  run({ args }) {
    const tree = createCpuHeavyTree()

    const registry = new TreeRegistry()
    registry.register('demo-cpu-heavy', tree)

    const link = new StudioLink({
      createTransport: WsNodeStringTransport.createFactory(args.url),
    })

    const agent = new StudioAgent({
      clientId: 'cli-demo',
      sessionId: `demo-${Date.now()}`,
      registry,
      link,
    })

    agent.start()
    console.log(`Demo agent started, connecting to ${args.url}`)

    const interval = setInterval(() => {
      tree.tick()
      agent.tick()
    }, 200)

    const shutdown = () => {
      console.log('\nShutting down...')
      clearInterval(interval)
      agent.destroy()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  },
})
