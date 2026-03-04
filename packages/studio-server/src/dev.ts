import { createStudioServer } from './index.js'

const server = createStudioServer()

server.start()

const shutdown = async () => {
  await server.stop()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
