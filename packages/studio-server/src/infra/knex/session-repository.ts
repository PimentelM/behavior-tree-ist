import type { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { SessionRepositoryInterface } from '../../domain/interfaces';
import type { DbSession } from './schemas';
import { mapDbSessionToDomain, mapSessionToDb } from './mappers';

export class SessionRepository extends BaseKnexRepository implements SessionRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findByClientId(clientId: string) {
        const rows = await this.withTransaction(
            this.knex<DbSession>('sessions').where('clientId', clientId).orderBy('lastSeenAt', 'desc')
        );
        return rows.map(mapDbSessionToDomain);
    }

    async upsert(clientId: string, sessionId: string): Promise<void> {
        const now = Date.now();
        const dbSession = mapSessionToDb({
            clientId,
            sessionId,
            startedAt: now,
            lastSeenAt: now,
        });

        await this.withTransaction(
            this.knex('sessions')
                .insert(dbSession)
                .onConflict(['clientId', 'sessionId'])
                .merge({ lastSeenAt: now })
        );
    }

    async findById(clientId: string, sessionId: string) {
        const row = await this.withTransaction(
            this.knex<DbSession>('sessions')
                .where({ clientId, sessionId })
                .first()
        );
        return row ? mapDbSessionToDomain(row) : undefined;
    }

    async updateLastSeen(clientId: string, sessionId: string): Promise<void> {
        await this.withTransaction(
            this.knex('sessions')
                .where({ clientId, sessionId })
                .update({ lastSeenAt: Date.now() })
        );
    }
}
