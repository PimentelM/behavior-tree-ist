import { createStudioServer } from './index.js'

const server = createStudioServer()

void server.start()

const shutdown = async () => {
  await server.stop()
  process.exit(0)
}

process.on('SIGINT', () => { void shutdown(); })
process.on('SIGTERM', () => { void shutdown(); })
