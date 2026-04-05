/** @param {import('knex').Knex} knex */
export async function up(knex) {
    await knex.schema.createTable('logs', (table) => {
        table.increments('id').primary();
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.double('timestamp').notNullable();
        table.integer('level').notNullable();
        table.text('event').notNullable();
        table.text('message').notNullable();
    });

    await knex.schema.alterTable('logs', (table) => {
        table.index(['clientId', 'id'], 'idxLogsClientIdId');
        table.index(['clientId', 'sessionId', 'id'], 'idxLogsClientSessionIdId');
    });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
    await knex.schema.dropTableIfExists('logs');
}
