import type { TickRecord } from '@bt-studio/core';
import type { TickBounds } from '@bt-studio/studio-common';
import { BaseKnexRepository } from './base-repository';
import { type TickRepositoryInterface } from '../../domain/interfaces';
import type { DbTick } from './schemas';
import { mapDbTickToDomain, mapTickToDb } from './mappers';

interface TickBoundsRow {
    minTickId: string | null;
    maxTickId: string | null;
    count: string;
}


export class TickRepository extends BaseKnexRepository implements TickRepositoryInterface {
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
        const rows = (await this.withTransaction(
            this.knex<DbTick>('ticks')
                .where({ clientId, sessionId, treeId })
                .andWhere('tickId', '>', afterTickId)
                .orderBy('tickId', 'asc')
                .limit(limit)
        )) as DbTick[];
        return rows.map(mapDbTickToDomain);
    }

    async findBefore(
        clientId: string,
        sessionId: string,
        treeId: string,
        beforeTickId: number,
        limit: number
    ): Promise<TickRecord[]> {
        const rows = (await this.withTransaction(
            this.knex<DbTick>('ticks')
                .where({ clientId, sessionId, treeId })
                .andWhere('tickId', '<', beforeTickId)
                .orderBy('tickId', 'desc')
                .limit(limit)
        )) as DbTick[];
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
        const rows = (await this.withTransaction(query)) as DbTick[];
        return rows.map(mapDbTickToDomain);
    }

    async getTickBounds(
        clientId: string,
        sessionId: string,
        treeId: string
    ): Promise<TickBounds | null> {
        const result = (await this.withTransaction(
            this.knex('ticks')
                .where({ clientId, sessionId, treeId })
                .select(
                    this.knex.raw('MIN("tickId") as "minTickId"'),
                    this.knex.raw('MAX("tickId") as "maxTickId"'),
                    this.knex.raw('COUNT(*) as count')
                )
                .first()
        )) as TickBoundsRow | undefined;
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
        const keepSubquery = this.knex('ticks')
            .where({ clientId, sessionId, treeId })
            .orderBy('tickId', 'desc')
            .limit(maxTicks)
            .select('tickId');

        await this.withTransaction(
            this.knex('ticks')
                .where({ clientId, sessionId, treeId })
                .whereNotIn('tickId', keepSubquery)
                .delete()
        );
    }
}
