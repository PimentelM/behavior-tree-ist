import type { Knex } from 'knex';
import type { TickRecord } from '@bt-studio/core';
import { BaseKnexRepository } from './base-repository';
import { TickRepositoryInterface } from '../../domain/interfaces';
import type { DbTick } from './schemas';
import { mapDbTickToDomain, mapTickToDb } from './mappers';

export class TickRepository extends BaseKnexRepository implements TickRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async insertBatch(
        clientId: string,
        sessionId: string,
        treeId: string,
        ticks: TickRecord[]
    ): Promise<void> {
        if (ticks.length === 0) return;

        const rows: DbTick[] = ticks.map((tick) => mapTickToDb({
            clientId,
            sessionId,
            treeId,
            tick,
        }));

        await this.withTransaction(
            this.knex('ticks').insert(rows)
        );
    }

    async findAfter(
        clientId: string,
        sessionId: string,
        treeId: string,
        afterTickId: number,
        limit: number
    ): Promise<TickRecord[]> {
        const rows = await this.withTransaction(
            this.knex<DbTick>('ticks')
                .where({ clientId, sessionId, treeId })
                .andWhere('tickId', '>', afterTickId)
                .orderBy('tickId', 'asc')
                .limit(limit)
        );
        return rows.map(mapDbTickToDomain);
    }

    async pruneToLimit(
        clientId: string,
        sessionId: string,
        treeId: string,
        maxTicks: number
    ): Promise<void> {
        const count = await this.withTransaction(
            this.knex('ticks')
                .where({ clientId, sessionId, treeId })
                .count('* as cnt')
        );

        const total = Number((count[0] as { cnt: number | string }).cnt);
        if (total <= maxTicks) return;

        const toDelete = total - maxTicks;
        const oldest = await this.withTransaction(
            this.knex('ticks')
                .where({ clientId, sessionId, treeId })
                .orderBy('tickId', 'asc')
                .limit(toDelete)
                .select('tickId')
        );

        const tickIds = oldest.map((r: { tickId: number }) => r.tickId);
        if (tickIds.length > 0) {
            await this.withTransaction(
                this.knex('ticks')
                    .where({ clientId, sessionId, treeId })
                    .whereIn('tickId', tickIds)
                    .delete()
            );
        }
    }
}
