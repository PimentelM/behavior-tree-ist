import { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { SettingsRepositoryInterface, SettingsRow } from '../../domain/interfaces';

export class SettingsRepository extends BaseKnexRepository implements SettingsRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async get(): Promise<SettingsRow> {
        const row = await this.withTransaction(
            this.knex<SettingsRow>('server_settings').where('id', 1).first()
        );

        if (!row) {
            // Insert default row if missing
            const now = Date.now();
            await this.withTransaction(
                this.knex('server_settings').insert({
                    id: 1,
                    max_ticks_per_tree: 1000,
                    command_timeout_ms: 5000,
                    updated_at: now,
                })
            );
            return { id: 1, max_ticks_per_tree: 1000, command_timeout_ms: 5000, updated_at: now };
        }

        return row;
    }

    async update(settings: Partial<Pick<SettingsRow, 'max_ticks_per_tree' | 'command_timeout_ms'>>): Promise<void> {
        await this.withTransaction(
            this.knex('server_settings')
                .where('id', 1)
                .update({ ...settings, updated_at: Date.now() })
        );
    }
}
