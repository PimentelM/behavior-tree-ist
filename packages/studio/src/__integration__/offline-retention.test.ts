import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence } from '@behavior-tree-ist/core/builder';

describe('Integration: Offline Retention (Criteria 3)', () => {
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

    it('Client disconnection marks client as offline; data remains visible via API', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-offline', registry);

        let now = 1000;
        for (let i = 0; i < 3; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree', record);
            agent.tick({ now });
        }
        await sleep(200);

        let clients = await ctx.trpc.getClients.query();
        expect(clients.find(c => c.clientId === 'client-offline')?.isOnline).toBe(true);

        const ticksBefore = await ctx.trpc.getTicks.query({ clientId: 'client-offline', treeId: 'test-tree' });
        expect(ticksBefore).toHaveLength(3);
        const treesBefore = await ctx.trpc.getTrees.query({ clientId: 'client-offline' });
        expect(treesBefore).toHaveLength(1);

        // Disconnect agent
        agent.disconnect();
        await sleep(200);

        clients = await ctx.trpc.getClients.query();
        expect(clients.find(c => c.clientId === 'client-offline')?.isOnline).toBe(false);

        // Data should STILL be visible
        const ticksAfter = await ctx.trpc.getTicks.query({ clientId: 'client-offline', treeId: 'test-tree' });
        expect(ticksAfter).toHaveLength(3);

        const treesAfter = await ctx.trpc.getTrees.query({ clientId: 'client-offline' });
        expect(treesAfter).toHaveLength(1);
    });

    it('RemoveTree clears tree metadata and tick history immediately', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-offline', registry);

        const now = 1000;
        const record = tree.tick({ now });
        registry.reportTick('test-tree', record);
        agent.tick({ now });
        await sleep(200);

        const ticksBefore = await ctx.trpc.getTicks.query({ clientId: 'client-offline', treeId: 'test-tree' });
        expect(ticksBefore).toHaveLength(1);

        registry.remove('test-tree');
        agent.tick({ now: now + 100 }); // flush queue
        await sleep(200);

        const ticksAfter = await ctx.trpc.getTicks.query({ clientId: 'client-offline', treeId: 'test-tree' });
        expect(ticksAfter).toHaveLength(0);

        const treesAfter = await ctx.trpc.getTrees.query({ clientId: 'client-offline' });
        expect(treesAfter).toHaveLength(0);
    });

    it('Hard delete via API fully removes all client-scoped data', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-hard-delete', registry);

        let now = 1000;
        for (let i = 0; i < 2; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree', record);
            agent.tick({ now });
        }
        await sleep(200);

        expect(await ctx.trpc.getClients.query()).toEqual(
            expect.arrayContaining([expect.objectContaining({ clientId: 'client-hard-delete' })]),
        );
        expect(await ctx.trpc.getTrees.query({ clientId: 'client-hard-delete' })).toHaveLength(1);
        expect(await ctx.trpc.getTicks.query({ clientId: 'client-hard-delete', treeId: 'test-tree' })).toHaveLength(2);

        await ctx.trpc.deleteClient.mutate({ clientId: 'client-hard-delete' });

        const clientsAfterDelete = await ctx.trpc.getClients.query();
        expect(clientsAfterDelete.find(c => c.clientId === 'client-hard-delete')).toBeUndefined();
        expect(await ctx.trpc.getTrees.query({ clientId: 'client-hard-delete' })).toHaveLength(0);
        expect(await ctx.trpc.getTicks.query({ clientId: 'client-hard-delete', treeId: 'test-tree' })).toHaveLength(0);
    });
});
