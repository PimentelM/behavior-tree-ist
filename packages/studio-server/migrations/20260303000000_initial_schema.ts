import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('clients', (table) => {
        table.text('clientId').primary();
        table.float('firstSeenAt').notNullable();
        table.float('lastSeenAt').notNullable();
    });

    await knex.schema.createTable('sessions', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.float('startedAt').notNullable();
        table.float('lastSeenAt').notNullable();
        table.primary(['clientId', 'sessionId']);
    });

    await knex.schema.createTable('trees', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.text('treeId').notNullable();
        table.text('serializedTreeJson').notNullable();
        table.float('removedAt').nullable();
        table.float('updatedAt').notNullable();
        table.primary(['clientId', 'sessionId', 'treeId']);
    });

    await knex.schema.createTable('ticks', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.text('treeId').notNullable();
        table.integer('tickId').notNullable();
        table.float('timestamp').notNullable();
        table.text('payloadJson').notNullable();
        table.primary(['clientId', 'sessionId', 'treeId', 'tickId']);
    });

    await knex.schema.createTable('serverSettings', (table) => {
        table.integer('id').primary().defaultTo(1);
        table.integer('maxTicksPerTree').defaultTo(1000);
        table.integer('commandTimeoutMs').defaultTo(5000);
        table.float('updatedAt').notNullable();
    });

    // Index for cursor queries on ticks
    await knex.schema.alterTable('ticks', (table) => {
        table.index(['clientId', 'sessionId', 'treeId', 'tickId'], 'idxTicksCursor');
    });

    // Insert default settings row
    await knex('serverSettings').insert({
        id: 1,
        maxTicksPerTree: 1000,
        commandTimeoutMs: 5000,
        updatedAt: Date.now(),
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('serverSettings');
    await knex.schema.dropTableIfExists('ticks');
    await knex.schema.dropTableIfExists('trees');
    await knex.schema.dropTableIfExists('sessions');
    await knex.schema.dropTableIfExists('clients');
}
