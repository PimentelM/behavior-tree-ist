import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('clients', (table) => {
        table.text('client_id').primary();
        table.float('first_seen_at').notNullable();
        table.float('last_seen_at').notNullable();
    });

    await knex.schema.createTable('sessions', (table) => {
        table.text('client_id').notNullable();
        table.text('session_id').notNullable();
        table.float('started_at').notNullable();
        table.float('last_seen_at').notNullable();
        table.primary(['client_id', 'session_id']);
    });

    await knex.schema.createTable('trees', (table) => {
        table.text('client_id').notNullable();
        table.text('session_id').notNullable();
        table.text('tree_id').notNullable();
        table.text('serialized_tree_json').notNullable();
        table.float('removed_at').nullable();
        table.float('updated_at').notNullable();
        table.primary(['client_id', 'session_id', 'tree_id']);
    });

    await knex.schema.createTable('ticks', (table) => {
        table.text('client_id').notNullable();
        table.text('session_id').notNullable();
        table.text('tree_id').notNullable();
        table.integer('tick_id').notNullable();
        table.float('timestamp').notNullable();
        table.text('payload_json').notNullable();
        table.primary(['client_id', 'session_id', 'tree_id', 'tick_id']);
    });

    await knex.schema.createTable('server_settings', (table) => {
        table.integer('id').primary().defaultTo(1);
        table.integer('max_ticks_per_tree').defaultTo(1000);
        table.integer('command_timeout_ms').defaultTo(5000);
        table.float('updated_at').notNullable();
    });

    // Index for cursor queries on ticks
    await knex.schema.alterTable('ticks', (table) => {
        table.index(['client_id', 'session_id', 'tree_id', 'tick_id'], 'idx_ticks_cursor');
    });

    // Insert default settings row
    await knex('server_settings').insert({
        id: 1,
        max_ticks_per_tree: 1000,
        command_timeout_ms: 5000,
        updated_at: Date.now(),
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('server_settings');
    await knex.schema.dropTableIfExists('ticks');
    await knex.schema.dropTableIfExists('trees');
    await knex.schema.dropTableIfExists('sessions');
    await knex.schema.dropTableIfExists('clients');
}
