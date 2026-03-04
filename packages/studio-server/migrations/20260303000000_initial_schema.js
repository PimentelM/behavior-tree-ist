/** @param {import('knex').Knex} knex */
export async function up(knex) {
    await knex.schema.createTable('clients', (table) => {
        table.text('clientId').primary();
        table.double('firstSeenAt').notNullable();
        table.double('lastSeenAt').notNullable();
    });

    await knex.schema.createTable('sessions', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.double('startedAt').notNullable();
        table.double('lastSeenAt').notNullable();
        table.primary(['clientId', 'sessionId']);
    });

    await knex.schema.createTable('trees', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.text('treeId').notNullable();
        table.text('serializedTreeJson').notNullable();
        table.check('json_valid(serializedTreeJson)', [], 'chkTreesSerializedTreeJsonValidJson');
        table.double('removedAt').nullable();
        table.double('updatedAt').notNullable();
        table.primary(['clientId', 'sessionId', 'treeId']);
    });

    await knex.schema.createTable('ticks', (table) => {
        table.text('clientId').notNullable();
        table.text('sessionId').notNullable();
        table.text('treeId').notNullable();
        table.integer('tickId').notNullable();
        table.double('timestamp').notNullable();
        table.text('payloadJson').notNullable();
        table.check('json_valid(payloadJson)', [], 'chkTicksPayloadJsonValidJson');
        table.primary(['clientId', 'sessionId', 'treeId', 'tickId']);
    });

    await knex.schema.createTable('serverSettings', (table) => {
        table.integer('id').primary().defaultTo(1);
        table.integer('maxTicksPerTree').defaultTo(1000);
        table.integer('commandTimeoutMs').defaultTo(5000);
        table.double('updatedAt').notNullable();
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

/** @param {import('knex').Knex} knex */
export async function down(knex) {
    await knex.schema.dropTableIfExists('serverSettings');
    await knex.schema.dropTableIfExists('ticks');
    await knex.schema.dropTableIfExists('trees');
    await knex.schema.dropTableIfExists('sessions');
    await knex.schema.dropTableIfExists('clients');
}
