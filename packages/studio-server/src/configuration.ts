export interface StudioServerConfig {
    http: {
        port: number;
        host: string;
    };
    ws: {
        path: string;
    };
    sqlite: {
        path: string;
    };
    commandTimeoutMs: number;
    maxTicksPerTree: number;
    logLevel: string;
}

export function makeConfig(): StudioServerConfig {
    return {
        http: {
            port: parseInt(process.env.HTTP_PORT || '4100', 10),
            host: process.env.HTTP_HOST || '0.0.0.0',
        },
        ws: {
            path: process.env.WS_PATH || '/ws',
        },
        sqlite: {
            path: process.env.SQLITE_PATH || ':memory:',
        },
        commandTimeoutMs: parseInt(process.env.COMMAND_TIMEOUT_MS || '5000', 10),
        maxTicksPerTree: parseInt(process.env.MAX_TICKS_PER_TREE || '1000', 10),
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}
