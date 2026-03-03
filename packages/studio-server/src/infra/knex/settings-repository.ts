import type { Knex } from 'knex';
import { BaseKnexRepository } from './base-repository';
import { SettingsRepositoryInterface } from '../../domain/interfaces';
import type { SettingsRecord } from '../../domain/records';
import type { DbSettings } from './schemas';
import { mapDbSettingsToDomain, mapSettingsToDb } from './mappers';

export class SettingsRepository extends BaseKnexRepository implements SettingsRepositoryInterface {
    constructor(knex: Knex) {
        super(knex);
    }

    async get(): Promise<SettingsRecord> {
        const row = await this.withTransaction(
            this.knex<DbSettings>('serverSettings').where('id', 1).first()
        );

        if (!row) {
            const now = Date.now();
            const defaultSettings: SettingsRecord = {
                id: 1,
                maxTicksPerTree: 1000,
                commandTimeoutMs: 5000,
                updatedAt: now,
            };

            await this.withTransaction(
                this.knex('serverSettings').insert(mapSettingsToDb(defaultSettings))
            );
            return defaultSettings;
        }

        return mapDbSettingsToDomain(row);
    }

    async update(settings: Partial<Pick<SettingsRecord, 'maxTicksPerTree' | 'commandTimeoutMs'>>): Promise<void> {
        const dbUpdates: Partial<DbSettings> = {};
        if (settings.maxTicksPerTree !== undefined) dbUpdates.maxTicksPerTree = settings.maxTicksPerTree;
        if (settings.commandTimeoutMs !== undefined) dbUpdates.commandTimeoutMs = settings.commandTimeoutMs;

        await this.withTransaction(
            this.knex('serverSettings')
                .where('id', 1)
                .update({ ...dbUpdates, updatedAt: Date.now() })
        );
    }
}
