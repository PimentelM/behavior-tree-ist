export const studioLogLevels = [
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
] as const

export type StudioLogLevel = (typeof studioLogLevels)[number]

export interface StudioServerOptions {
  httpHost?: string
  httpPort?: number
  tcpHost?: string
  tcpPort?: number
  sqlitePath?: string
  commandTimeoutMs?: number
  maxTicksPerTree?: number
  logLevel?: StudioLogLevel
}

export interface ResolvedStudioServerConfig {
  httpHost: string
  httpPort: number
  tcpHost: string
  tcpPort: number
  sqlitePath: string
  commandTimeoutMs: number
  maxTicksPerTree: number
  logLevel: StudioLogLevel
}
