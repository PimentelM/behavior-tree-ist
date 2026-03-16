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

    return {
        debug(message, meta) {
            // eslint-disable-next-line no-console
            console.debug(format('DEBUG', message, meta));
        },
        info(message, meta) {
            // eslint-disable-next-line no-console
            console.info(format('INFO', message, meta));
        },
        warn(message, meta) {
            // eslint-disable-next-line no-console
            console.warn(format('WARN', message, meta));
        },
        error(message, meta) {
            // eslint-disable-next-line no-console
            console.error(format('ERROR', message, meta));
        },
    };
}
