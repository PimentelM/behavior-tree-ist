import knex, { type Knex } from 'knex';
import path from 'path';
import { StudioServerConfig } from '../../configuration';

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
        directory: path.resolve(__dirname, '../../../migrations'),
        extension: 'ts' as const,
    };

    return createKnexInstance({
        client: 'better-sqlite3',
        connection: { filename: config.sqlite.path },
        useNullAsDefault: true,
        migrations,
    });
}
