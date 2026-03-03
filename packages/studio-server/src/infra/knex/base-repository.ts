import { AsyncLocalStorage } from 'async_hooks';
import { Knex } from 'knex';

type TransactionContext = {
    trx: Knex.Transaction | null;
};

export abstract class BaseKnexRepository {
    protected knex: Knex;

    constructor(knex: Knex) {
        this.knex = knex;
    }

    static asyncTransactionContext = new AsyncLocalStorage<TransactionContext>();

    withTransaction(qb: Knex.QueryBuilder) {
        const { trx } = BaseKnexRepository.asyncTransactionContext.getStore() ?? {};
        if (trx) {
            return qb.transacting(trx);
        }
        return qb;
    }

    async executeTransactionally<T>(callback: () => Promise<T>): Promise<T> {
        const trx = await this.knex.transaction();
        return BaseKnexRepository.asyncTransactionContext.run({ trx }, async () => {
            try {
                const result = await callback();
                await trx.commit();
                return result;
            } catch (error) {
                await trx.rollback();
                throw error;
            }
        });
    }
}
