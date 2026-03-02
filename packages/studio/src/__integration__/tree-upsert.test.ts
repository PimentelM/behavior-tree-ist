import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence, condition } from '@behavior-tree-ist/core/builder';

describe('Integration: Tree Upsert Invalidation (Criteria 4)', () => {
    let ctx: IntegrationTestContext;

    beforeEach(async () => {
        ctx = await createTestContext();
    });

    afterEach(async () => {
        await teardownTestContext(ctx);
    });

    const createTreeA = () => new BehaviourTree(
        sequence({ name: 'root' }, [
            action({
                execute: () => NodeResult.Succeeded,
            })
        ])
    );

    const createTreeB = () => new BehaviourTree(
        sequence({ name: 'root-modified' }, [
            condition({ eval: () => true }),
            action({
                execute: () => NodeResult.Succeeded,
            })
        ])
    );

    it('RegisterTree with same serialized hash keeps existing tick history', async () => {
        const registry = new TreeRegistry();
        const tree1 = createTreeA();
        registry.register('test-tree', tree1, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-upsert', registry);

        // Generate some ticks
        let now = 1000;
        for (let i = 0; i < 3; i++) {
            now += 100;
            const record = tree1.tick({ now });
            registry.reportTick('test-tree', record);
            agent.tick({ now });
        }
        await sleep(200);

        const resultBefore = await ctx.trpc.getTicks.query({ clientId: 'client-upsert', treeId: 'test-tree' });
        expect(resultBefore).toHaveLength(3);

        // Reconnect with the exact same tree structure
        agent.disconnect();
        const registry2 = new TreeRegistry();
        registry2.register('test-tree', tree1, { streaming: true });

        const agent2 = await createTestAgent(ctx, 'client-upsert', registry2);
        agent2.tick({ now: now + 100 });

        await sleep(200); // Wait for the new register-tree event to reach the server

        const resultAfter = await ctx.trpc.getTicks.query({ clientId: 'client-upsert', treeId: 'test-tree' });
        expect(resultAfter).toHaveLength(3);
    });

    it('RegisterTree with different serialized hash clears existing tick history', async () => {
        const registry = new TreeRegistry();
        const tree1 = createTreeA();
        registry.register('test-tree', tree1, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-upsert', registry);

        // Generate some ticks
        let now = 1000;
        for (let i = 0; i < 3; i++) {
            now += 100;
            const record = tree1.tick({ now });
            registry.reportTick('test-tree', record);
            agent.tick({ now });
        }
        await sleep(200);

        const resultBefore = await ctx.trpc.getTicks.query({ clientId: 'client-upsert', treeId: 'test-tree' });
        expect(resultBefore).toHaveLength(3);

        // Reconnect with a different tree structure
        agent.disconnect();
        const registry2 = new TreeRegistry();
        const tree2 = createTreeB(); // Different structure yields different hash
        registry2.register('test-tree', tree2, { streaming: true });

        const agent2 = await createTestAgent(ctx, 'client-upsert', registry2);
        agent2.tick({ now: now + 100 });

        await sleep(200); // Wait for the new register-tree event to reach the server

        const resultAfter = await ctx.trpc.getTicks.query({ clientId: 'client-upsert', treeId: 'test-tree' });
        expect(resultAfter).toHaveLength(0); // Ticks should have been cleared
    });
});
