/** @param {import('knex').Knex} knex */
export async function up(knex) {
    await knex.schema.alterTable('ticks', (table) => {
        table.dropIndex([], 'idxTicksCursor');
    });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
    await knex.schema.alterTable('ticks', (table) => {
        table.index(['clientId', 'sessionId', 'treeId', 'tickId'], 'idxTicksCursor');
    });
}
