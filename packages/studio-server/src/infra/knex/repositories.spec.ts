import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { Knex } from 'knex';
import { createSqliteMemoryKnexInstance } from './knex-factory';
import { ClientRepository } from './client-repository';
import { SessionRepository } from './session-repository';
import { TreeRepository } from './tree-repository';
import { SettingsRepository } from './settings-repository';

describe('Knex repositories', () => {
    let knex: Knex;
    let clientRepository: ClientRepository;
    let sessionRepository: SessionRepository;
    let treeRepository: TreeRepository;
    let settingsRepository: SettingsRepository;

    beforeEach(async () => {
        knex = createSqliteMemoryKnexInstance({
            directory: path.join(__dirname, '../../../migrations'),
            extension: 'ts',
        });
        await knex.migrate.latest();

        clientRepository = new ClientRepository(knex);
        sessionRepository = new SessionRepository(knex);
        treeRepository = new TreeRepository(knex);
        settingsRepository = new SettingsRepository(knex);
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await knex.destroy();
    });

    it('client upsert is idempotent and updates lastSeenAt', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(1000);
        await clientRepository.upsert('client-1');

        nowSpy.mockReturnValueOnce(2000);
        await clientRepository.upsert('client-1');

        const rows = await knex('clients').where({ clientId: 'client-1' });
        expect(rows).toHaveLength(1);
        expect(rows[0].firstSeenAt).toBe(1000);
        expect(rows[0].lastSeenAt).toBe(2000);
    });

    it('session upsert is idempotent on composite key and updates lastSeenAt', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(3000);
        await sessionRepository.upsert('client-1', 'session-1');

        nowSpy.mockReturnValueOnce(4000);
        await sessionRepository.upsert('client-1', 'session-1');

        const rows = await knex('sessions').where({ clientId: 'client-1', sessionId: 'session-1' });
        expect(rows).toHaveLength(1);
        expect(rows[0].startedAt).toBe(3000);
        expect(rows[0].lastSeenAt).toBe(4000);
    });

    it('tree upsert updates existing rows without duplication', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(5000);
        await treeRepository.upsert('client-1', 'session-1', 'tree-1', {
            id: 1,
            nodeFlags: 1,
            defaultName: 'TreeA',
            name: 'TreeA',
            children: [],
        });

        nowSpy.mockReturnValueOnce(6000);
        await treeRepository.upsert('client-1', 'session-1', 'tree-1', {
            id: 1,
            nodeFlags: 1,
            defaultName: 'TreeB',
            name: 'TreeB',
            children: [],
        });

        const rows = await knex('trees').where({ clientId: 'client-1', sessionId: 'session-1', treeId: 'tree-1' });
        expect(rows).toHaveLength(1);
        expect(rows[0].updatedAt).toBe(6000);
        expect(rows[0].removedAt).toBeNull();

        const tree = await treeRepository.findById('client-1', 'session-1', 'tree-1');
        expect(tree?.serializedTree.name).toBe('TreeB');
    });

    it('settings update recreates default row if missing', async () => {
        await knex('serverSettings').where({ id: 1 }).delete();

        await settingsRepository.update({ commandTimeoutMs: 9000 });
        const settings = await settingsRepository.get();

        expect(settings.id).toBe(1);
        expect(settings.commandTimeoutMs).toBe(9000);
        expect(settings.maxTicksPerTree).toBe(1000);
    });
});
