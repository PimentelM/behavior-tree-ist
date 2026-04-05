import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import path from 'path';
import type { Knex } from 'knex';
import { NodeResult, type TickRecord } from '@bt-studio/core';
import { createSqliteMemoryKnexInstance } from './knex-factory';
import { ClientRepository } from './client-repository';
import { SessionRepository } from './session-repository';
import { TreeRepository } from './tree-repository';
import { SettingsRepository } from './settings-repository';
import { TickRepository } from './tick-repository';
import { LogRepository } from './log-repository';

describe('Knex repositories', () => {
    let knex: Knex;
    let clientRepository: ClientRepository;
    let sessionRepository: SessionRepository;
    let treeRepository: TreeRepository;
    let settingsRepository: SettingsRepository;

    beforeEach(async () => {
        knex = createSqliteMemoryKnexInstance({
            directory: path.join(__dirname, '../../../migrations'),
            extension: 'js',
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
        expect((rows[0] as (typeof rows)[number]).firstSeenAt).toBe(1000);
        expect((rows[0] as (typeof rows)[number]).lastSeenAt).toBe(2000);
    });

    it('session upsert is idempotent on composite key and updates lastSeenAt', async () => {
        const nowSpy = vi.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(3000);
        await sessionRepository.upsert('client-1', 'session-1');

        nowSpy.mockReturnValueOnce(4000);
        await sessionRepository.upsert('client-1', 'session-1');

        const rows = await knex('sessions').where({ clientId: 'client-1', sessionId: 'session-1' });
        expect(rows).toHaveLength(1);
        expect((rows[0] as (typeof rows)[number]).startedAt).toBe(3000);
        expect((rows[0] as (typeof rows)[number]).lastSeenAt).toBe(4000);
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
        expect((rows[0] as (typeof rows)[number]).updatedAt).toBe(6000);
        expect((rows[0] as (typeof rows)[number]).removedAt).toBeNull();

        const tree = await treeRepository.findById('client-1', 'session-1', 'tree-1');
        expect(tree?.serializedTree.name).toBe('TreeB');
    });

    it('settings update recreates default row if missing', async () => {
        await knex('serverSettings').where({ id: 1 }).delete();

        await settingsRepository.update({ commandTimeoutMs: 9000 });
        const settings = await settingsRepository.get();

        expect(settings.id).toBe(1);
        expect(settings.commandTimeoutMs).toBe(9000);
        expect(settings.maxTicksPerTree).toBe(100_000);
    });
});

describe('TickRepository', () => {
    let knex: Knex;
    let tickRepository: TickRepository;

    const C = 'client-1';
    const S = 'session-1';
    const T = 'tree-1';

    function makeTick(tickId: number, timestamp?: number): TickRecord {
        return { tickId, timestamp: timestamp ?? tickId * 100, events: [{ nodeId: 1, result: NodeResult.Succeeded }], refEvents: [] };
    }

    beforeEach(async () => {
        knex = createSqliteMemoryKnexInstance({
            directory: path.join(__dirname, '../../../migrations'),
            extension: 'js',
        });
        await knex.migrate.latest();
        tickRepository = new TickRepository(knex);
    });

    afterEach(async () => {
        await knex.destroy();
    });

    it('findRange returns ticks within inclusive range', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        const result = await tickRepository.findRange(C, S, T, 2, 4);

        expect(result.map(t => t.tickId)).toEqual([2, 3, 4]);
    });

    it('findRange returns empty for non-existent range', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2)]);

        const result = await tickRepository.findRange(C, S, T, 10, 20);

        expect(result).toHaveLength(0);
    });

    it('getTickBounds returns min/max/count', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(5), makeTick(10), makeTick(15)]);

        const bounds = await tickRepository.getTickBounds(C, S, T);

        expect(bounds).toEqual({ minTickId: 5, maxTickId: 15, totalCount: 3 });
    });

    it('getTickBounds returns null for empty tree', async () => {
        const bounds = await tickRepository.getTickBounds(C, S, T);

        expect(bounds).toBeNull();
    });

    it('findRange respects limit', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        const result = await tickRepository.findRange(C, S, T, 1, 5, 3);

        expect(result).toHaveLength(3);
        expect(result.map(t => t.tickId)).toEqual([1, 2, 3]);
    });

    it('findBefore returns ticks before given id in ascending order', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        const result = await tickRepository.findBefore(C, S, T, 4, 2);

        expect(result.map(t => t.tickId)).toEqual([2, 3]);
    });

    it('findBefore returns all ticks before id when limit is large', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4)]);

        const result = await tickRepository.findBefore(C, S, T, 5, 10);

        expect(result.map(t => t.tickId)).toEqual([1, 2, 3, 4]);
    });

    it('findAfter returns ticks after given id in ascending order', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        const result = await tickRepository.findAfter(C, S, T, 2, 10);

        expect(result.map(t => t.tickId)).toEqual([3, 4, 5]);
    });

    it('findAfter respects limit', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        const result = await tickRepository.findAfter(C, S, T, 1, 2);

        expect(result.map(t => t.tickId)).toEqual([2, 3]);
    });

    it('findAfter returns empty for afterTickId beyond all ticks', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2)]);

        const result = await tickRepository.findAfter(C, S, T, 100, 10);

        expect(result).toHaveLength(0);
    });

    it('pruneToLimit does nothing when count is within limit', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3)]);

        await tickRepository.pruneToLimit(C, S, T, 5);

        const bounds = await tickRepository.getTickBounds(C, S, T);
        expect(bounds?.totalCount).toBe(3);
    });

    it('pruneToLimit deletes oldest ticks to reach limit', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3), makeTick(4), makeTick(5)]);

        await tickRepository.pruneToLimit(C, S, T, 3);

        const bounds = await tickRepository.getTickBounds(C, S, T);
        expect(bounds?.totalCount).toBe(3);
        expect(bounds?.minTickId).toBe(3);
        expect(bounds?.maxTickId).toBe(5);
    });

    it('pruneToLimit leaves exactly maxTicks ticks', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3)]);

        await tickRepository.pruneToLimit(C, S, T, 1);

        const result = await tickRepository.findAfter(C, S, T, 0, 10);
        expect(result.map(t => t.tickId)).toEqual([3]);
    });

    it('pruneToLimit only affects matching client/session/tree', async () => {
        await tickRepository.insertBatch(C, S, T, [makeTick(1), makeTick(2), makeTick(3)]);
        await tickRepository.insertBatch('other', S, T, [makeTick(1), makeTick(2), makeTick(3)]);

        await tickRepository.pruneToLimit(C, S, T, 1);

        const otherBounds = await tickRepository.getTickBounds('other', S, T);
        expect(otherBounds?.totalCount).toBe(3);
    });
});

describe('LogRepository', () => {
    let knex: Knex;
    let logRepository: LogRepository;

    beforeEach(async () => {
        knex = createSqliteMemoryKnexInstance({
            directory: path.join(__dirname, '../../../migrations'),
            extension: 'js',
        });
        await knex.migrate.latest();
        logRepository = new LogRepository(knex);
    });

    afterEach(async () => {
        await knex.destroy();
    });

    async function insert(
        clientId: string,
        sessionId: string,
        timestamp: number,
        level: number,
        event: string,
        message: string,
    ) {
        await logRepository.insert(clientId, sessionId, { timestamp, level, event, message });
    }

    it('returns newest-first logs for a client', async () => {
        await insert('client-1', 'session-1', 10, 2, 'Old', 'old');
        await insert('client-1', 'session-1', 20, 2, 'New', 'new');

        const page = await logRepository.query({ clientId: 'client-1', limit: 10 });

        expect(page.items.map((item: { event: string }) => item.event)).toEqual(['New', 'Old']);
    });

    it('narrows by sessionId and minLevel', async () => {
        await insert('client-1', 'session-1', 10, 4, 'Trace', 'trace');
        await insert('client-1', 'session-1', 11, 1, 'Warn', 'warn');
        await insert('client-1', 'session-2', 12, 0, 'Error', 'error');

        const page = await logRepository.query({
            clientId: 'client-1',
            sessionId: 'session-1',
            minLevel: 1,
            limit: 10,
        });

        expect(page.items.map((item: { event: string }) => item.event)).toEqual(['Warn']);
    });

    it('supports beforeId pagination cursor', async () => {
        await insert('client-1', 'session-1', 10, 2, 'One', 'one');
        await insert('client-1', 'session-1', 20, 2, 'Two', 'two');
        await insert('client-1', 'session-1', 30, 2, 'Three', 'three');

        const first = await logRepository.query({ clientId: 'client-1', limit: 2 });
        if (first.nextCursor === null) {
            throw new Error('Expected a pagination cursor for the first page');
        }
        const second = await logRepository.query({
            clientId: 'client-1',
            beforeId: first.nextCursor,
            limit: 2,
        });

        expect(first.items.map((item: { event: string }) => item.event)).toEqual(['Three', 'Two']);
        expect(second.items.map((item: { event: string }) => item.event)).toEqual(['One']);
        expect(second.nextCursor).toBeNull();
    });

    it('returns null nextCursor when the page exhausts results', async () => {
        await insert('client-1', 'session-1', 10, 2, 'One', 'one');
        await insert('client-1', 'session-1', 20, 2, 'Two', 'two');

        const page = await logRepository.query({ clientId: 'client-1', limit: 10 });

        expect(page.nextCursor).toBeNull();
    });

    it('prunes oldest rows per client only', async () => {
        await insert('client-1', 'session-1', 10, 2, 'One', 'one');
        await insert('client-1', 'session-1', 20, 2, 'Two', 'two');
        await insert('client-1', 'session-1', 30, 2, 'Three', 'three');
        await insert('client-2', 'session-1', 40, 2, 'Other', 'other');

        await logRepository.pruneToLimit('client-1', 2);

        const clientOne = await logRepository.query({ clientId: 'client-1', limit: 10 });
        const clientTwo = await logRepository.query({ clientId: 'client-2', limit: 10 });

        expect(clientOne.items.map((item: { event: string }) => item.event)).toEqual(['Three', 'Two']);
        expect(clientTwo.items.map((item: { event: string }) => item.event)).toEqual(['Other']);
    });
});
