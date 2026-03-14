import type { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { type ClientRepositoryInterface } from '../../domain/interfaces';
import type { DbClient } from './schemas';
import { mapClientToDb, mapDbClientToDomain } from './mappers';

export class ClientRepository extends BaseKnexRepository implements ClientRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async findById(clientId: string) {
        const row = await this.withTransaction(
            this.knex<DbClient>('clients').where('clientId', clientId).first()
        );
        return row ? mapDbClientToDomain(row) : undefined;
    }

    async upsert(clientId: string): Promise<void> {
        const now = Date.now();
        const dbClient = mapClientToDb({
            clientId,
            firstSeenAt: now,
            lastSeenAt: now,
        });

        await this.withTransaction(
            this.knex('clients')
                .insert(dbClient)
                .onConflict('clientId')
                .merge({ lastSeenAt: now })
        );
    }

    async findAll() {
        const rows = await this.withTransaction(
            this.knex<DbClient>('clients').select('*').orderBy('lastSeenAt', 'desc')
        );
        return rows.map(mapDbClientToDomain);
    }

    async updateLastSeen(clientId: string): Promise<void> {
        await this.withTransaction(
            this.knex('clients').where('clientId', clientId).update({ lastSeenAt: Date.now() })
        );
    }
}
