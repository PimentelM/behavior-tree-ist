import { afterEach, describe, expect, it } from 'vitest';
import { makeConfig } from './configuration';
import { createStudioServer } from './index';

const BASE_ENV = { ...process.env };

function resetEnv(): void {
    process.env = { ...BASE_ENV };
}

describe('Configuration', () => {
    afterEach(() => {
        resetEnv();
    });

    it('builds a valid config from defaults', () => {
        delete process.env.HTTP_PORT;
        delete process.env.COMMAND_TIMEOUT_MS;
        delete process.env.MAX_TICKS_PER_TREE;
        delete process.env.RUN_MIGRATIONS_ON_STARTUP;

        const config = makeConfig();

        expect(config.http.port).toBe(4100);
        expect(config.commandTimeoutMs).toBe(5000);
        expect(config.maxTicksPerTree).toBe(1000);
        expect(config.migrations.runOnStartup).toBe(true);
    });

    it('fails fast for non-numeric integer env values', () => {
        process.env.HTTP_PORT = 'not-a-number';
        expect(() => makeConfig()).toThrow(/HTTP_PORT must be an integer/);
    });

    it('fails fast for invalid integer ranges', () => {
        process.env.HTTP_PORT = '70000';
        expect(() => makeConfig()).toThrow(/http.port/);
    });

    it('fails fast for invalid boolean env values', () => {
        process.env.RUN_MIGRATIONS_ON_STARTUP = 'sometimes';
        expect(() => makeConfig()).toThrow(/RUN_MIGRATIONS_ON_STARTUP must be a boolean/);
    });

    it('validates options when creating the server', () => {
        expect(() => createStudioServer({ httpPort: 0 })).toThrow(/http.port/);
    });
});
