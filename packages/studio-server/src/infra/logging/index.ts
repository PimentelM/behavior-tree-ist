export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLogLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel): void {
    currentLogLevel = level;
}

export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(name: string): Logger {
    const prefix = `[${name}]`;

    function format(level: string, message: string, meta?: Record<string, unknown>): string {
        const ts = new Date().toISOString();
        const base = `${ts} ${level} ${prefix} ${message}`;
        return meta && Object.keys(meta).length > 0
            ? `${base} ${JSON.stringify(meta)}`
            : base;
    }

    function isEnabled(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
    }

    return {
        debug(message, meta) {
            if (!isEnabled('debug')) return;
            // eslint-disable-next-line no-console
            console.debug(format('DEBUG', message, meta));
        },
        info(message, meta) {
            if (!isEnabled('info')) return;
            // eslint-disable-next-line no-console
            console.info(format('INFO', message, meta));
        },
        warn(message, meta) {
            if (!isEnabled('warn')) return;
            // eslint-disable-next-line no-console
            console.warn(format('WARN', message, meta));
        },
        error(message, meta) {
            if (!isEnabled('error')) return;
            // eslint-disable-next-line no-console
            console.error(format('ERROR', message, meta));
        },
    };
}
