import {
  studioLogLevels,
  type ResolvedStudioServerConfig,
  type StudioLogLevel,
  type StudioServerOptions,
} from './studio-server-options'

export class StudioServerConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudioServerConfigError'
  }
}

export type StudioServerEnv = Readonly<Record<string, string | undefined>>

type ConfigKey = keyof ResolvedStudioServerConfig

type ConfigField<K extends ConfigKey> = {
  key: K
  envKeys: readonly string[]
  defaultValue: ResolvedStudioServerConfig[K]
  parse: (value: unknown, source: string) => ResolvedStudioServerConfig[K]
}

const MAX_PORT = 65_535

const parseInteger = (value: unknown, source: string): number => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new StudioServerConfigError(`${source} must be an integer.`)
    }
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      throw new StudioServerConfigError(`${source} cannot be an empty string.`)
    }

    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isInteger(parsed)) {
      throw new StudioServerConfigError(`${source} must be an integer.`)
    }
    return parsed
  }

  throw new StudioServerConfigError(`${source} must be an integer.`)
}

const parsePort = (value: unknown, source: string): number => {
  const parsed = parseInteger(value, source)
  if (parsed < 0 || parsed > MAX_PORT) {
    throw new StudioServerConfigError(`${source} must be between 0 and ${MAX_PORT}.`)
  }
  return parsed
}

const parsePositiveInteger = (value: unknown, source: string): number => {
  const parsed = parseInteger(value, source)
  if (parsed <= 0) {
    throw new StudioServerConfigError(`${source} must be greater than 0.`)
  }
  return parsed
}

const parseNonEmptyString = (value: unknown, source: string): string => {
  if (typeof value !== 'string') {
    throw new StudioServerConfigError(`${source} must be a string.`)
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new StudioServerConfigError(`${source} cannot be empty.`)
  }

  return trimmed
}

const parseLogLevel = (value: unknown, source: string): StudioLogLevel => {
  if (typeof value !== 'string') {
    throw new StudioServerConfigError(`${source} must be a string.`)
  }

  if (studioLogLevels.includes(value as StudioLogLevel)) {
    return value as StudioLogLevel
  }

  throw new StudioServerConfigError(
    `${source} must be one of: ${studioLogLevels.join(', ')}.`,
  )
}

const configSchema: {
  [K in ConfigKey]: ConfigField<K>
} = {
  httpHost: {
    key: 'httpHost',
    envKeys: ['BTIST_STUDIO_HTTP_HOST', 'STUDIO_SERVER_HTTP_HOST'],
    defaultValue: '127.0.0.1',
    parse: parseNonEmptyString,
  },
  httpPort: {
    key: 'httpPort',
    envKeys: ['BTIST_STUDIO_HTTP_PORT', 'STUDIO_SERVER_HTTP_PORT'],
    defaultValue: 4317,
    parse: parsePort,
  },
  tcpHost: {
    key: 'tcpHost',
    envKeys: ['BTIST_STUDIO_TCP_HOST', 'STUDIO_SERVER_TCP_HOST'],
    defaultValue: '127.0.0.1',
    parse: parseNonEmptyString,
  },
  tcpPort: {
    key: 'tcpPort',
    envKeys: ['BTIST_STUDIO_TCP_PORT', 'STUDIO_SERVER_TCP_PORT'],
    defaultValue: 4318,
    parse: parsePort,
  },
  sqlitePath: {
    key: 'sqlitePath',
    envKeys: ['BTIST_STUDIO_SQLITE_PATH', 'STUDIO_SERVER_SQLITE_PATH'],
    defaultValue: ':memory:',
    parse: parseNonEmptyString,
  },
  commandTimeoutMs: {
    key: 'commandTimeoutMs',
    envKeys: ['BTIST_STUDIO_COMMAND_TIMEOUT_MS', 'STUDIO_SERVER_COMMAND_TIMEOUT_MS'],
    defaultValue: 5_000,
    parse: parsePositiveInteger,
  },
  maxTicksPerTree: {
    key: 'maxTicksPerTree',
    envKeys: ['BTIST_STUDIO_MAX_TICKS_PER_TREE', 'STUDIO_SERVER_MAX_TICKS_PER_TREE'],
    defaultValue: 5_000,
    parse: parsePositiveInteger,
  },
  logLevel: {
    key: 'logLevel',
    envKeys: ['BTIST_STUDIO_LOG_LEVEL', 'STUDIO_SERVER_LOG_LEVEL'],
    defaultValue: 'info',
    parse: parseLogLevel,
  },
}

const configKeys = Object.keys(configSchema) as ConfigKey[]

const readEnvValue = (
  env: StudioServerEnv,
  envKeys: readonly string[],
): { key: string; value: string } | null => {
  for (const key of envKeys) {
    const value = env[key]
    if (value !== undefined) {
      return { key, value }
    }
  }

  return null
}

export const STUDIO_SERVER_CONFIG_DEFAULTS: Readonly<ResolvedStudioServerConfig> = {
  httpHost: configSchema.httpHost.defaultValue,
  httpPort: configSchema.httpPort.defaultValue,
  tcpHost: configSchema.tcpHost.defaultValue,
  tcpPort: configSchema.tcpPort.defaultValue,
  sqlitePath: configSchema.sqlitePath.defaultValue,
  commandTimeoutMs: configSchema.commandTimeoutMs.defaultValue,
  maxTicksPerTree: configSchema.maxTicksPerTree.defaultValue,
  logLevel: configSchema.logLevel.defaultValue,
}

export const STUDIO_SERVER_ENV_VARS: Readonly<Record<ConfigKey, readonly string[]>> = {
  httpHost: configSchema.httpHost.envKeys,
  httpPort: configSchema.httpPort.envKeys,
  tcpHost: configSchema.tcpHost.envKeys,
  tcpPort: configSchema.tcpPort.envKeys,
  sqlitePath: configSchema.sqlitePath.envKeys,
  commandTimeoutMs: configSchema.commandTimeoutMs.envKeys,
  maxTicksPerTree: configSchema.maxTicksPerTree.envKeys,
  logLevel: configSchema.logLevel.envKeys,
}

const applyFieldOverrides = <K extends ConfigKey>(
  resolved: ResolvedStudioServerConfig,
  key: K,
  options: StudioServerOptions,
  env: StudioServerEnv,
): void => {
  const field = configSchema[key]
  const envEntry = readEnvValue(env, field.envKeys)
  if (envEntry !== null) {
    resolved[key] = field.parse(envEntry.value, `env.${envEntry.key}`)
  }

  const optionValue = options[key]
  if (optionValue !== undefined) {
    resolved[key] = field.parse(optionValue, `options.${String(key)}`)
  }
}

export function resolveStudioServerConfig(
  options: StudioServerOptions = {},
  env: StudioServerEnv = process.env,
): ResolvedStudioServerConfig {
  const resolved = { ...STUDIO_SERVER_CONFIG_DEFAULTS }

  for (const key of configKeys) {
    applyFieldOverrides(resolved, key, options, env)
  }

  return resolved
}
