import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, teardownTestContext, createTestAgent, IntegrationTestContext, sleep } from './test-helpers';
import { TreeRegistry, StudioAgent, WebSocketTransport } from '@behavior-tree-ist/studio-transport';
import { BehaviourTree, NodeResult } from '@behavior-tree-ist/core';
import { action, sequence } from '@behavior-tree-ist/core/builder';
import { WebSocket } from 'ws';

describe('Integration: Backpressure (Criteria 7)', () => {
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
                execute: () => NodeResult.Succeeded
            })
        ])
    );

    it('Full outbound queue drops oldest unsent records', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        // Create agent with very small queue capacity
        const queueCapacity = 5;
        const transport = new WebSocketTransport(`ws://localhost:${ctx.wsPort}/ws`, {
            WebSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
        });
        const agent = new StudioAgent('client-bp', registry, { queueCapacity });
        agent.connect(transport);
        ctx.clients.push(agent);

        // Wait for connection
        await new Promise<void>((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (agent.isConnected) {
                    clearInterval(interval);
                    resolve();
                }
                if (Date.now() - start > 5000) {
                    clearInterval(interval);
                    reject(new Error('Agent failed to connect after 5s'));
                }
            }, 10);
        });

        // The queue already has ClientHello + RegisterTree = 2 messages.
        // Now queue more tick messages to overflow the queue.
        // With capacity 5, after the 2 initial messages we can fit 3 more before overflow.
        let now = 1000;
        const tickCount = 10;
        for (let i = 0; i < tickCount; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree', record);
            // Do NOT call agent.tick() - we want to accumulate messages in the queue
        }

        // Queue now has: 2 initial + 10 tick batches = 12 messages attempted into capacity-5 queue
        // The oldest 7 were dropped (including ClientHello and RegisterTree)
        // Only the 5 most recent TickBatch messages remain

        // Now flush the queue
        agent.tick({ now });
        await sleep(300);

        // Since ClientHello was dropped, the server never learned about this client.
        // The ticks will also fail to process since the tree was never registered.
        // This proves the oldest messages (ClientHello, RegisterTree) were dropped.
        const clients = await ctx.trpc.getClients.query();
        const bpClient = clients.find(c => c.clientId === 'client-bp');
        expect(bpClient).toBeUndefined();
    });

    it('Queue with sufficient capacity delivers all messages', async () => {
        const registry = new TreeRegistry();
        const tree = createTree();
        registry.register('test-tree', tree, { streaming: true });

        // Create agent with enough capacity to hold all messages
        const agent = await createTestAgent(ctx, 'client-bp-ok', registry);

        let now = 1000;
        for (let i = 0; i < 5; i++) {
            now += 100;
            const record = tree.tick({ now });
            registry.reportTick('test-tree', record);
        }
        agent.tick({ now });
        await sleep(300);

        const ticks = await ctx.trpc.getTicks.query({ clientId: 'client-bp-ok', treeId: 'test-tree' });
        expect(ticks).toHaveLength(5);
    });
});
