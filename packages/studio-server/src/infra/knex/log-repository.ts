import type { LogQuery, LogQueryPage, LogRecord } from '@bt-studio/studio-common';
import { BaseKnexRepository } from './base-repository';
import type { LogRepositoryInterface } from '../../domain/interfaces';
import type { DbLog } from './schemas';
import { mapDbLogToDomain, mapLogToDb } from './mappers';

export class LogRepository extends BaseKnexRepository implements LogRepositoryInterface {
    async insert(
        clientId: string,
        sessionId: string,
        log: Omit<LogRecord, 'id' | 'clientId' | 'sessionId'>,
    ): Promise<void> {
        await this.withTransaction(
            this.knex<DbLog>('logs').insert(mapLogToDb({ clientId, sessionId, log }))
        );
    }

    async query(input: LogQuery & { limit: number }): Promise<LogQueryPage> {
        const rows = (await this.withTransaction(
            this.buildQuery(input)
        )) as Required<DbLog>[];

        const hasMore = rows.length > input.limit;
        const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
        const items = pageRows.map(mapDbLogToDomain);
        const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;
        return { items, nextCursor };
    }

    async pruneToLimit(clientId: string, maxLogs: number): Promise<void> {
        await this.executeTransactionally(async () => {
            const [{ count }] = (await this.withTransaction(
                this.knex('logs')
                    .where({ clientId })
                    .count({ count: '*' })
            )) as [{ count: string | number }];

            if (Number(count) <= maxLogs) return;

            const keepSubquery = this.knex('logs')
                .where({ clientId })
                .orderBy('id', 'desc')
                .limit(maxLogs)
                .select('id');

            await this.withTransaction(
                this.knex('logs')
                    .where({ clientId })
                    .whereNotIn('id', keepSubquery)
                    .delete()
            );
        });
    }

    private buildQuery(input: LogQuery & { limit: number }) {
        let query = this.knex<DbLog>('logs')
            .where({ clientId: input.clientId })
            .orderBy('id', 'desc')
            .limit(input.limit + 1);

        if (input.sessionId) {
            query = query.andWhere({ sessionId: input.sessionId });
        }

        if (input.minLevel !== undefined) {
            query = query.andWhere('level', '<=', input.minLevel);
        }

        if (input.beforeId !== undefined) {
            query = query.andWhere('id', '<', input.beforeId);
        }

        return query;
    }
}
