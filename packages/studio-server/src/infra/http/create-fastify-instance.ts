import Fastify, { type FastifyInstance } from 'fastify'
import type { StudioLogLevel } from '../../config'

export function createFastifyInstance(logLevel: StudioLogLevel): FastifyInstance {
  return Fastify({
    logger: {
      level: logLevel,
    },
  })
}
