import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from '../subscription-manager';
import type { Logger } from '../../logger';

describe('SubscriptionManager', () => {
    const mockLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    };

    it('subscribes a client to a topic', () => {
        const manager = new SubscriptionManager(mockLogger);
        expect(manager.subscribe('client1', 'topicA')).toBe(true);
        expect(manager.hasSubscription('client1', 'topicA')).toBe(true);

        // Should return false if already subscribed
        expect(manager.subscribe('client1', 'topicA')).toBe(false);
    });

    it('unsubscribes a client from a topic', () => {
        const manager = new SubscriptionManager(mockLogger);
        manager.subscribe('client1', 'topicA');
        expect(manager.unsubscribe('client1', 'topicA')).toBe(true);
        expect(manager.hasSubscription('client1', 'topicA')).toBe(false);

        // Should return false if not subscribed
        expect(manager.unsubscribe('client1', 'topicA')).toBe(false);
    });

    it('unsubscribes a client from all topics', () => {
        const manager = new SubscriptionManager(mockLogger);
        manager.subscribe('client1', 'topicA');
        manager.subscribe('client1', 'topicB');

        manager.unsubscribeAll('client1');

        expect(manager.hasSubscription('client1', 'topicA')).toBe(false);
        expect(manager.hasSubscription('client1', 'topicB')).toBe(false);
    });

    it('gets subscribers for a topic considering wildcards', () => {
        const manager = new SubscriptionManager(mockLogger);
        manager.subscribe('client1', 'player/*/logs');
        manager.subscribe('client2', 'player/123/logs');
        manager.subscribe('client3', 'system/events');

        const subscribers = manager.getSubscribersForTopic('player/123/logs');

        expect(subscribers).toContain('client1'); // client1 has a wildcard that matches
        expect(subscribers).toContain('client2'); // client2 has exact match
        expect(subscribers).not.toContain('client3'); // client3 has different topic
    });
});
