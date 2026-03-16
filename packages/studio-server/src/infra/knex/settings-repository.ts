import { BaseKnexRepository } from './base-repository';
import { type SettingsRepositoryInterface } from '../../domain/interfaces';
import type { SettingsRecord } from '../../domain/records';
import type { DbSettings } from './schemas';
import { mapDbSettingsToDomain } from './mappers';

export class SettingsRepository extends BaseKnexRepository implements SettingsRepositoryInterface {

    private async ensureDefaultRow(): Promise<void> {
        const now = Date.now();
        await this.withTransaction(
            this.knex('serverSettings')
                .insert({
                    id: 1,
                    maxTicksPerTree: 100_000,
                    commandTimeoutMs: 5000,
                    updatedAt: now,
                })
                .onConflict('id')
                .ignore()
        );
    }

    async get(): Promise<SettingsRecord> {
        await this.ensureDefaultRow();

        const row = (await this.withTransaction(
            this.knex<DbSettings>('serverSettings').where('id', 1).first()
        )) as DbSettings | undefined;

        if (!row) {
            throw new Error('Settings row not found after initialization');
        }

        return mapDbSettingsToDomain(row);
    }

    async update(settings: Partial<Pick<SettingsRecord, 'maxTicksPerTree' | 'commandTimeoutMs'>>): Promise<void> {
        await this.ensureDefaultRow();

        const dbUpdates: Partial<DbSettings> = {};
        if (settings.maxTicksPerTree !== undefined) dbUpdates.maxTicksPerTree = settings.maxTicksPerTree;
        if (settings.commandTimeoutMs !== undefined) dbUpdates.commandTimeoutMs = settings.commandTimeoutMs;

        if (Object.keys(dbUpdates).length === 0) {
            return;
        }

        await this.withTransaction(
            this.knex('serverSettings')
                .where('id', 1)
                .update({ ...dbUpdates, updatedAt: Date.now() })
        );
    }
}
