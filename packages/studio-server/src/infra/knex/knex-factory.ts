import knex, { type Knex } from 'knex';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { type StudioServerConfig } from '../../configuration';

function findMigrationsDir(): string {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 10; i++) {
        const candidate = path.join(dir, 'migrations');
        if (existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    throw new Error('Could not find migrations directory');
}

export function createKnexInstance(config: Knex.Config): Knex {
    return knex(config);
}

export function createSqliteFileKnexInstance(filename: string): Knex {
    return createKnexInstance({
        client: 'better-sqlite3',
        connection: { filename },
        useNullAsDefault: true,
    });
}

export function createSqliteMemoryKnexInstance(migrationsConfig?: {
    directory?: string;
    extension?: string;
}): Knex {
    return createKnexInstance({
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
        migrations: migrationsConfig,
    });
}

export function createKnexFromConfig(config: StudioServerConfig): Knex {
    const migrations = {
        directory: findMigrationsDir(),
        extension: 'js' as const,
    };

    return createKnexInstance({
        client: 'better-sqlite3',
        connection: { filename: config.sqlite.path },
        useNullAsDefault: true,
        migrations,
    });
}
