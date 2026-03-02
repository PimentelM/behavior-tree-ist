import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence } from '@behavior-tree-ist/core/builder';

describe('Integration: Identity and Restart (Criteria 1)', () => {
    let ctx: IntegrationTestContext;

    beforeEach(async () => {
        ctx = await createTestContext();
    });

    afterEach(async () => {
        await teardownTestContext(ctx);
    });

    const createTree = () => new BehaviourTree(
        sequence({ name: 'root' }, [
            action({ execute: () => NodeResult.Succeeded })
        ])
    );

    it('Same (clientId, treeId) works across agent disconnect/reconnect', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree);

        // 1. First connection
        let agent = await createTestAgent(ctx, 'client-1', registry);
        agent.tick({ now: Date.now() });

        await sleep(100);

        let clients = await ctx.trpc.getClients.query();
        expect(clients).toHaveLength(1);
        expect(clients[0].clientId).toBe('client-1');

        let trees = await ctx.trpc.getTrees.query({ clientId: 'client-1' });
        expect(trees).toHaveLength(1);
        expect(trees[0].treeId).toBe('test-tree');

        // 2. Disconnect
        agent.disconnect();

        // Server cleanup might take a moment or be triggered by WS close immediately
        await sleep(200);

        clients = await ctx.trpc.getClients.query();
        expect(clients[0].disconnectedAt).toBeDefined();

        // 3. Reconnect
        agent = await createTestAgent(ctx, 'client-1', registry);
        agent.tick({ now: Date.now() });
        await sleep(100);

        clients = await ctx.trpc.getClients.query();
        expect(clients.length).toBe(1); // Same client id reused
        expect(clients[0].disconnectedAt).toBeUndefined(); // Back online

        trees = await ctx.trpc.getTrees.query({ clientId: 'client-1' });
        expect(trees).toHaveLength(1);
        expect(trees[0].treeId).toBe('test-tree');
    });

    it('Duplicate/older now-based tickId is rejected at the core level', () => {
        const tree = createTree();
        tree.useNowAsTickId();

        tree.tick({ now: 1000 });

        expect(() => tree.tick({ now: 1000 })).toThrow(/strictly increasing/);
        expect(() => tree.tick({ now: 999 })).toThrow(/strictly increasing/);
    });
});
