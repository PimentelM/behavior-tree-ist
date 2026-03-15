import type { Knex } from 'knex';
import type { TickRecord } from '@bt-studio/core';
import type { TickBounds } from '@bt-studio/studio-common';
import { BaseKnexRepository } from './base-repository';
import { type TickRepositoryInterface } from '../../domain/interfaces';
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

    async findBefore(
        clientId: string,
        sessionId: string,
        treeId: string,
        beforeTickId: number,
        limit: number
    ): Promise<TickRecord[]> {
        const rows = await this.withTransaction(
            this.knex<DbTick>('ticks')
                .where({ clientId, sessionId, treeId })
                .andWhere('tickId', '<', beforeTickId)
                .orderBy('tickId', 'desc')
                .limit(limit)
        );
        return rows.reverse().map(mapDbTickToDomain);
    }

    async findRange(
        clientId: string,
        sessionId: string,
        treeId: string,
        fromTickId: number,
        toTickId: number,
        limit?: number
    ): Promise<TickRecord[]> {
        let query = this.knex<DbTick>('ticks')
            .where({ clientId, sessionId, treeId })
            .andWhere('tickId', '>=', fromTickId)
            .andWhere('tickId', '<=', toTickId)
            .orderBy('tickId', 'asc');
        if (limit !== undefined) query = query.limit(limit);
        const rows = await this.withTransaction(query);
        return rows.map(mapDbTickToDomain);
    }

    async getTickBounds(
        clientId: string,
        sessionId: string,
        treeId: string
    ): Promise<TickBounds | null> {
        const result = await this.withTransaction(
            this.knex('ticks')
                .where({ clientId, sessionId, treeId })
                .select(
                    this.knex.raw('MIN("tickId") as "minTickId"'),
                    this.knex.raw('MAX("tickId") as "maxTickId"'),
                    this.knex.raw('COUNT(*) as count')
                )
                .first()
        );
        if (!result || Number(result.count) === 0) return null;
        return {
            minTickId: Number(result.minTickId),
            maxTickId: Number(result.maxTickId),
            totalCount: Number(result.count),
        };
    }

    async pruneToLimit(
        clientId: string,
        sessionId: string,
        treeId: string,
        maxTicks: number
    ): Promise<void> {
        await this.executeTransactionally(async () => {
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
        });
    }
}
