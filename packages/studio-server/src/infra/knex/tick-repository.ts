import { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { TickRepositoryInterface, TickRow } from '../../domain/interfaces';

export class TickRepository extends BaseKnexRepository implements TickRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async insertBatch(
        clientId: string,
        sessionId: string,
        treeId: string,
        ticks: Array<{ tickId: number; timestamp: number; payloadJson: string }>
    ): Promise<void> {
        if (ticks.length === 0) return;

        const rows = ticks.map(tick => ({
            client_id: clientId,
            session_id: sessionId,
            tree_id: treeId,
            tick_id: tick.tickId,
            timestamp: tick.timestamp,
            payload_json: tick.payloadJson,
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
    ): Promise<TickRow[]> {
        return this.withTransaction(
            this.knex<TickRow>('ticks')
                .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                .andWhere('tick_id', '>', afterTickId)
                .orderBy('tick_id', 'asc')
                .limit(limit)
        );
    }

    async pruneToLimit(
        clientId: string,
        sessionId: string,
        treeId: string,
        maxTicks: number
    ): Promise<void> {
        const count = await this.withTransaction(
            this.knex('ticks')
                .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                .count('* as cnt')
        );

        const total = (count[0] as { cnt: number }).cnt;
        if (total <= maxTicks) return;

        const toDelete = total - maxTicks;
        const oldest = await this.withTransaction(
            this.knex('ticks')
                .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                .orderBy('tick_id', 'asc')
                .limit(toDelete)
                .select('tick_id')
        );

        const tickIds = oldest.map((r: { tick_id: number }) => r.tick_id);
        if (tickIds.length > 0) {
            await this.withTransaction(
                this.knex('ticks')
                    .where({ client_id: clientId, session_id: sessionId, tree_id: treeId })
                    .whereIn('tick_id', tickIds)
                    .delete()
            );
        }
    }
}
