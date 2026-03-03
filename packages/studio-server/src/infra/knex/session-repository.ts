import { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { SessionRepositoryInterface, SessionRow } from '../../domain/interfaces';

export class SessionRepository extends BaseKnexRepository implements SessionRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findByClientId(clientId: string): Promise<SessionRow[]> {
        return this.withTransaction(
            this.knex<SessionRow>('sessions').where('client_id', clientId).orderBy('last_seen_at', 'desc')
        );
    }

    async upsert(clientId: string, sessionId: string): Promise<void> {
        const now = Date.now();
        const existing = await this.findById(clientId, sessionId);
        if (existing) {
            await this.withTransaction(
                this.knex('sessions')
                    .where({ client_id: clientId, session_id: sessionId })
                    .update({ last_seen_at: now })
            );
        } else {
            await this.withTransaction(
                this.knex('sessions').insert({
                    client_id: clientId,
                    session_id: sessionId,
                    started_at: now,
                    last_seen_at: now,
                })
            );
        }
    }

    async findById(clientId: string, sessionId: string): Promise<SessionRow | undefined> {
        return this.withTransaction(
            this.knex<SessionRow>('sessions')
                .where({ client_id: clientId, session_id: sessionId })
                .first()
        );
    }

    async updateLastSeen(clientId: string, sessionId: string): Promise<void> {
        await this.withTransaction(
            this.knex('sessions')
                .where({ client_id: clientId, session_id: sessionId })
                .update({ last_seen_at: Date.now() })
        );
    }
}
