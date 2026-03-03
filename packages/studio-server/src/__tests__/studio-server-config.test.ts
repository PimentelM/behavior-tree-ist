import { describe, expect, it } from 'vitest'
import {
  STUDIO_SERVER_CONFIG_DEFAULTS,
  StudioServerConfigError,
  resolveStudioServerConfig,
} from '../config'

describe('resolveStudioServerConfig', () => {
  it('returns defaults when no options or env vars are provided', () => {
    const config = resolveStudioServerConfig({}, {})

    expect(config).toEqual(STUDIO_SERVER_CONFIG_DEFAULTS)
  })

  it('applies environment overrides', () => {
    const config = resolveStudioServerConfig(
      {},
      {
        BTIST_STUDIO_HTTP_HOST: '0.0.0.0',
        BTIST_STUDIO_HTTP_PORT: '9123',
        BTIST_STUDIO_TCP_HOST: '192.168.1.10',
        BTIST_STUDIO_TCP_PORT: '9124',
        BTIST_STUDIO_SQLITE_PATH: '/tmp/studio.db',
        BTIST_STUDIO_COMMAND_TIMEOUT_MS: '8000',
        BTIST_STUDIO_MAX_TICKS_PER_TREE: '2000',
        BTIST_STUDIO_LOG_LEVEL: 'debug',
      },
    )

    expect(config).toEqual({
      httpHost: '0.0.0.0',
      httpPort: 9123,
      tcpHost: '192.168.1.10',
      tcpPort: 9124,
      sqlitePath: '/tmp/studio.db',
      commandTimeoutMs: 8000,
      maxTicksPerTree: 2000,
      logLevel: 'debug',
    })
  })

  it('lets explicit options override env values', () => {
    const config = resolveStudioServerConfig(
      {
        httpPort: 4300,
        logLevel: 'trace',
      },
      {
        BTIST_STUDIO_HTTP_PORT: '9123',
        BTIST_STUDIO_LOG_LEVEL: 'info',
      },
    )

    expect(config.httpPort).toBe(4300)
    expect(config.logLevel).toBe('trace')
  })

  it('throws a typed error for invalid values', () => {
    expect(() =>
      resolveStudioServerConfig(
        {
          commandTimeoutMs: 0,
        },
        {},
      ),
    ).toThrow(StudioServerConfigError)
  })
})
