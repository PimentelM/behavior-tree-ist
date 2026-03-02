import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence } from '@behavior-tree-ist/core/builder';

describe('Integration: Polling (Criteria 2)', () => {
    let ctx: IntegrationTestContext;

    beforeEach(async () => {
        ctx = await createTestContext();
    });

    afterEach(async () => {
        await teardownTestContext(ctx);
    });

    const createTree = () => new BehaviourTree(
        sequence({ name: 'root' }, [
            action({
                execute: () => NodeResult.Succeeded,
            })
        ])
    );

    it('Polling with afterTickId returns ticks where tickId > afterTickId, ordered ascending', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-poll', registry);

        let now = 1000;
        // Generate 5 ticks
        for (let i = 0; i < 5; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree', record);
            agent.tick({ now });
        }

        await sleep(200); // Wait for ticks to process on server

        const result = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree' });
        expect(result).toHaveLength(5);
        const secondTickId = result[1].tickId;

        expect(result[4].tickId).toBeGreaterThan(result[3].tickId);

        // Now query with afterTickId
        const resultAfter = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree', afterTickId: secondTickId });
        expect(resultAfter).toHaveLength(3);
        expect(resultAfter[0].tickId).toBe(result[2].tickId);
        expect(resultAfter[2].tickId).toBe(result[4].tickId);
    });

    it('If afterTickId is older than retained history, returns available ticks', async () => {
        // We update settings to max 3 ticks for test-tree
        await ctx.trpc.updateSettings.mutate({ maxTickRecordsPerTree: 3 });

        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree-short', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-poll', registry);

        let now = 1000;
        // Generate 5 ticks
        for (let i = 0; i < 5; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree-short', record);
            agent.tick({ now });
        }
        await sleep(200);

        // Now history should only have the 3 newest
        const result = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree-short' });
        expect(result).toHaveLength(3);

        // Fake an old afterTickId that was from before eviction
        const veryOldTickId = result[0].tickId - 1000;

        const gapResult = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree-short', afterTickId: veryOldTickId });

        // It should happily return the 3 retained without throwing a gap error
        expect(gapResult).toHaveLength(3);
        expect(gapResult[0].tickId).toBe(result[0].tickId);
    });

    it('Tick fetch limit is respected', async () => {
        await ctx.trpc.updateSettings.mutate({ maxTickRecordsPerTree: 100 });
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree-limit', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-poll', registry);

        let now = 1000;
        for (let i = 0; i < 10; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree-limit', record);
            agent.tick({ now });
        }
        await sleep(200);

        const result = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree-limit', limit: 2 });
        expect(result).toHaveLength(2);

        const fullResult = await ctx.trpc.getTicks.query({ clientId: 'client-poll', treeId: 'test-tree-limit' });
        // InMemoryTickRepository returns the MOST RECENT limit items
        expect(result[0].tickId).toBe(fullResult[fullResult.length - 2].tickId);
        expect(result[1].tickId).toBe(fullResult[fullResult.length - 1].tickId);
    });
});
