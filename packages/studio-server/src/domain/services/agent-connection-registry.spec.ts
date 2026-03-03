import { describe, expect, it } from 'vitest';
import { AgentConnectionRegistry } from './agent-connection-registry';

describe('AgentConnectionRegistry', () => {
    it('registers and retrieves connections by identity and connection id', () => {
        const registry = new AgentConnectionRegistry();

        registry.register('connection-1', 'client-1', 'session-1');

        expect(registry.getByConnectionId('connection-1')).toMatchObject({
            connectionId: 'connection-1',
            clientId: 'client-1',
            sessionId: 'session-1',
        });
        expect(registry.getByIdentity('client-1', 'session-1')).toMatchObject({
            connectionId: 'connection-1',
            clientId: 'client-1',
            sessionId: 'session-1',
        });
    });

    it('replaces old connection id for the same identity', () => {
        const registry = new AgentConnectionRegistry();

        registry.register('connection-1', 'client-1', 'session-1');
        registry.register('connection-2', 'client-1', 'session-1');

        expect(registry.getByConnectionId('connection-1')).toBeUndefined();
        expect(registry.getByConnectionId('connection-2')).toMatchObject({
            connectionId: 'connection-2',
            clientId: 'client-1',
            sessionId: 'session-1',
        });
    });

    it('unregisters by connection id and clears both indexes', () => {
        const registry = new AgentConnectionRegistry();

        registry.register('connection-1', 'client-1', 'session-1');

        const removed = registry.unregisterByConnectionId('connection-1');

        expect(removed).toMatchObject({
            connectionId: 'connection-1',
            clientId: 'client-1',
            sessionId: 'session-1',
        });
        expect(registry.getByConnectionId('connection-1')).toBeUndefined();
        expect(registry.getByIdentity('client-1', 'session-1')).toBeUndefined();
    });
});
