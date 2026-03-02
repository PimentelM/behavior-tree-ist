import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence } from '@behavior-tree-ist/core/builder';

describe('Integration: Remote Toggles (Criteria 5)', () => {
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

    it('Streaming is off by default until explicitly enabled', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        // Register WITHOUT streaming: true
        registry.register('test-tree', tree);

        const agent = await createTestAgent(ctx, 'client-toggles', registry); await sleep(200);

        let now = 1000;
        const tickRecord1 = tree.tick({ now });
        registry.reportTick('test-tree', tickRecord1);
        agent.tick({ now });
        await sleep(200);

        // Ticks should NOT reach the server
        let ticks = await ctx.trpc.getTicks.query({ clientId: 'client-toggles', treeId: 'test-tree' });
        expect(ticks).toHaveLength(0);

        // Enable streaming via API
        await ctx.trpc.enableStreaming.mutate({ clientId: 'client-toggles', treeId: 'test-tree' });
        await sleep(200); // Wait for command and ack

        // Now ticks SHOULD reach the server
        now += 100;
        const tickRecord2 = tree.tick({ now });
        registry.reportTick('test-tree', tickRecord2);
        agent.tick({ now });
        await sleep(200);

        ticks = await ctx.trpc.getTicks.query({ clientId: 'client-toggles', treeId: 'test-tree' });
        expect(ticks).toHaveLength(1);
    });

    it('Pausing streaming stops new tick uploads without disconnecting', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        const agent = await createTestAgent(ctx, 'client-toggles', registry); await sleep(200);

        // Disable streaming via API
        await ctx.trpc.disableStreaming.mutate({ clientId: 'client-toggles', treeId: 'test-tree' });
        await sleep(200); // Wait for command and ack

        const now = 1000;
        const tickRecord1 = tree.tick({ now });
        registry.reportTick('test-tree', tickRecord1);
        agent.tick({ now });
        await sleep(200);

        const ticks = await ctx.trpc.getTicks.query({ clientId: 'client-toggles', treeId: 'test-tree' });
        expect(ticks).toHaveLength(0);

        // Agent should still be online and Tree still registered
        const clients = await ctx.trpc.getClients.query();
        expect(clients.find(c => c.clientId === 'client-toggles')?.isOnline).toBe(true);

        const trees = await ctx.trpc.getTrees.query({ clientId: 'client-toggles' });
        expect(trees).toHaveLength(1);
    });

    it('Successful ack returns success true', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree);
        await createTestAgent(ctx, 'client-toggles', registry); await sleep(200);

        // Mutation resolves successfully instead of throwing Error
        await expect(ctx.trpc.enableStreaming.mutate({ clientId: 'client-toggles', treeId: 'test-tree' })).resolves.toEqual({ success: true });
    });

    it('Error ack returns success false with errorCode and errorMessage', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree);
        await createTestAgent(ctx, 'client-toggles', registry); await sleep(200);

        const result = await ctx.trpc.sendCommand.mutate({
            clientId: 'client-toggles',
            treeId: 'test-tree',
            command: 'enable-profiling',
        });

        expect(result.success).toBe(false);
        expect(result.errorCode).toBe('COMMAND_EXECUTION_ERROR');
        expect(result.errorMessage).toMatch(/Cannot enable profiling without a cached time provider/);
    });

    it('Ticks produced while streaming is disabled are not delivered retroactively', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: false });
        const agent = await createTestAgent(ctx, 'client-toggles', registry); await sleep(200);

        // Tick while disabled
        let now = 1000;
        const tickRecord1 = tree.tick({ now });
        registry.reportTick('test-tree', tickRecord1);
        agent.tick({ now });

        await ctx.trpc.enableStreaming.mutate({ clientId: 'client-toggles', treeId: 'test-tree' });
        await sleep(200);

        // The old tick shouldn't be delivered! Only new ones!
        now += 100;
        const tickRecord2 = tree.tick({ now });
        registry.reportTick('test-tree', tickRecord2);
        agent.tick({ now });
        await sleep(200);

        const ticks = await ctx.trpc.getTicks.query({ clientId: 'client-toggles', treeId: 'test-tree' });
        expect(ticks).toHaveLength(1); // Only the second tick!
    });
});
