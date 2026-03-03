import type { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { ClientRepositoryInterface, ClientRow } from '../../domain/interfaces';

export class ClientRepository extends BaseKnexRepository implements ClientRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findById(clientId: string): Promise<ClientRow | undefined> {
        return this.withTransaction(
            this.knex<ClientRow>('clients').where('client_id', clientId).first()
        );
    }

    async upsert(clientId: string): Promise<void> {
        const now = Date.now();
        const existing = await this.findById(clientId);
        if (existing) {
            await this.withTransaction(
                this.knex('clients').where('client_id', clientId).update({ last_seen_at: now })
            );
        } else {
            await this.withTransaction(
                this.knex('clients').insert({ client_id: clientId, first_seen_at: now, last_seen_at: now })
            );
        }
    }

    async findAll(): Promise<ClientRow[]> {
        return this.withTransaction(
            this.knex<ClientRow>('clients').select('*').orderBy('last_seen_at', 'desc')
        );
    }

    async updateLastSeen(clientId: string): Promise<void> {
        await this.withTransaction(
            this.knex('clients').where('client_id', clientId).update({ last_seen_at: Date.now() })
        );
    }
}
