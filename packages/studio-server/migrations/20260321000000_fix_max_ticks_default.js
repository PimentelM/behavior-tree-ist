/** @param {import('knex').Knex} knex */
export async function up(knex) {
    await knex('serverSettings')
        .where({ id: 1 })
        .update({ maxTicksPerTree: 100000, updatedAt: Date.now() });
}

/** @param {import('knex').Knex} knex */
export async function down(knex) {
    await knex('serverSettings')
        .where({ id: 1 })
        .update({ maxTicksPerTree: 1000, updatedAt: Date.now() });
}
