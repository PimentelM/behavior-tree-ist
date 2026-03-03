import type { Knex } from 'knex';
import path from 'path';

const config: Knex.Config = {
    client: 'better-sqlite3',
    connection: {
        filename: process.env.SQLITE_PATH || ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
        directory: path.resolve(__dirname, 'migrations'),
        extension: 'ts',
    },
};

export default config;
