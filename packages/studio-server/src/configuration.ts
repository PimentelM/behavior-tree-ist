import { parseStudioServerConfig, type StudioServerConfig } from './configuration-schema';

function readIntegerEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    if (!/^-?\d+$/.test(raw.trim())) {
        throw new Error(`${name} must be an integer, received "${raw}"`);
    }

    return Number.parseInt(raw, 10);
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }

    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
        return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
        return false;
    }

    throw new Error(`${name} must be a boolean, received "${raw}"`);
}

export function makeConfig(): StudioServerConfig {
    const httpHost = process.env.HTTP_HOST || '0.0.0.0';

    return parseStudioServerConfig({
        http: {
            port: readIntegerEnv('HTTP_PORT', 4100),
            host: httpHost,
        },
        tcp: {
            port: readIntegerEnv('TCP_PORT', 4101),
            host: process.env.TCP_HOST || httpHost,
        },
        ws: {
            path: process.env.WS_PATH || '/ws',
        },
        uiWs: {
            path: process.env.UI_WS_PATH || '/ui-ws',
        },
        sqlite: {
            path: process.env.SQLITE_PATH || ':memory:',
        },
        commandTimeoutMs: readIntegerEnv('COMMAND_TIMEOUT_MS', 5000),
        maxTicksPerTree: readIntegerEnv('MAX_TICKS_PER_TREE', 100_000),
        logLevel: process.env.LOG_LEVEL || 'info',
        migrations: {
            runOnStartup: readBooleanEnv('RUN_MIGRATIONS_ON_STARTUP', true),
        },
    });
}

export type { StudioServerConfig };
