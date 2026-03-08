import {
  TreeRegistry,
  StudioLink,
  StudioAgent,
} from '@bt-studio/core'
import { createCpuHeavyTree } from '@bt-studio/core/demos'
import { WsNodeStringTransport } from '@bt-studio/studio-transport/node'

export function startDemoAgent(wsUrl: string): { shutdown(): void } {
  const tree = createCpuHeavyTree()

  const registry = new TreeRegistry()
  registry.register('demo-cpu-heavy', tree)

  const link = new StudioLink({
    createTransport: WsNodeStringTransport.createFactory(wsUrl),
  })

  const agent = new StudioAgent({
    clientId: 'cli-demo',
    sessionId: `demo-${Date.now()}`,
    registry,
    link,
  })

  agent.start()

  const interval = setInterval(() => {
    tree.tick()
    agent.tick()
  }, 200)

  return {
    shutdown() {
      clearInterval(interval)
      agent.destroy()
    },
  }
}
