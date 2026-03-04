import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UiConnectionRegistry } from './ui-connection-registry';

describe('UiConnectionRegistry', () => {
    let registry: UiConnectionRegistry;

    beforeEach(() => {
        registry = new UiConnectionRegistry();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('registers a new connection', () => {
        vi.setSystemTime(1000);
        registry.register('conn-1');

        const connection = registry.getConnection('conn-1');
        expect(connection).toEqual({
            connectionId: 'conn-1',
            connectedAt: 1000,
        });
    });

    it('unregisters an existing connection', () => {
        registry.register('conn-1');
        const removed = registry.unregister('conn-1');

        expect(removed?.connectionId).toBe('conn-1');
        expect(registry.getConnection('conn-1')).toBeUndefined();
    });

    it('returns undefined when unregistering non-existent connection', () => {
        const removed = registry.unregister('conn-unknown');
        expect(removed).toBeUndefined();
    });

    it('returns all connected clients', () => {
        registry.register('conn-1');
        registry.register('conn-2');

        const connections = registry.getAllConnections();
        expect(connections).toHaveLength(2);
        expect(connections.map(c => c.connectionId)).toEqual(['conn-1', 'conn-2']);
    });
});
