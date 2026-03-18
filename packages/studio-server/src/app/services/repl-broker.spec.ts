import { describe, it, expect } from 'vitest';
import { ReplBroker } from './repl-broker';
import { type CommandSenderInterface } from '../interfaces';
import { type AgentEvent } from '../../domain/events';
import { EventDispatcher } from '../../infra/events/event-dispatcher';
import { createLogger } from '../../infra/logging';

class FakeCommandSender implements CommandSenderInterface {
    public readonly sent: Array<{ clientId: string; message: object }> = [];

    sendToClient(clientId: string, message: object): void {
        this.sent.push({ clientId, message });
    }
}

type SentPluginMessage = {
    t: number;
    pluginId: string;
    correlationId: string;
    payload: string;
};

function makeTestBroker(opts?: { resolveConnection?: (id: string) => { clientId: string; sessionId: string } | undefined }) {
    const sender = new FakeCommandSender();
    const eventDispatcher = new EventDispatcher(null, createLogger('test'));
    const dispatchedEvents: AgentEvent[] = [];

    eventDispatcher.on('Agent', 'ReplActivity', async (de) => {
        dispatchedEvents.push(de.event as AgentEvent);
    });

    const broker = new ReplBroker({
        commandSender: sender,
        eventDispatcher,
        resolveConnection: opts?.resolveConnection ?? (() => undefined),
    });
    return { sender, broker, dispatchedEvents };
}

function doHandshake(broker: ReplBroker, connectionId: string, headerToken = 'fake-header-token'): void {
    broker.handleAgentMessage(connectionId, 'handshake', { type: 'handshake', headerToken });
}

describe('ReplBroker', () => {
    it('stores handshake token when agent sends handshake', () => {
        const { broker } = makeTestBroker();

        broker.handleAgentMessage('conn-1', 'handshake', { type: 'handshake', headerToken: 'abc123' });

        expect(broker.getHandshakeToken('conn-1')).toBe('abc123');
    });

    it('relays encrypted payload to agent and resolves with raw agent response', async () => {
        const { sender, broker } = makeTestBroker({ resolveConnection: () => undefined });
        doHandshake(broker, 'conn-1');

        const relayPromise = broker.relay('conn-1', 'encrypted-eval-payload');

        expect(sender.sent).toHaveLength(1);
        const msg = (sender.sent[0] as (typeof sender.sent)[number]).message as SentPluginMessage;
        expect(msg.t).toBe(7);
        expect(msg.pluginId).toBe('repl');
        expect(msg.payload).toBe('encrypted-eval-payload');
        expect(typeof msg.correlationId).toBe('string');

        // Agent responds with encrypted blob
        broker.handleAgentMessage('conn-1', msg.correlationId, 'encrypted-agent-response');

        await expect(relayPromise).resolves.toBe('encrypted-agent-response');
    });

    it('rejects when no handshake has been done', async () => {
        const { broker } = makeTestBroker();

        await expect(broker.relay('conn-no-handshake', 'payload')).rejects.toThrow(/handshake not complete/);
    });

    it('rejects on timeout', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        await expect(broker.relay('conn-1', 'payload', 20)).rejects.toThrow(/timed out/);
    });

    it('rejects all pending on shutdown', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        const relayPromise = broker.relay('conn-1', 'payload');
        broker.shutdown();

        await expect(relayPromise).rejects.toThrow(/shutting down/);
    });

    it('logs warning for unknown correlationId without throwing', () => {
        const { broker } = makeTestBroker();

        expect(() => { broker.handleAgentMessage('conn-1', 'unknown-id', 'payload'); }).not.toThrow();
    });

    it('handles multiple concurrent relays independently', async () => {
        const { sender, broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        const p1 = broker.relay('conn-1', 'payload-1');
        const p2 = broker.relay('conn-1', 'payload-2');

        expect(sender.sent).toHaveLength(2);
        const msg1 = (sender.sent[0] as (typeof sender.sent)[number]).message as SentPluginMessage;
        const msg2 = (sender.sent[1] as (typeof sender.sent)[number]).message as SentPluginMessage;
        expect(msg1.correlationId).not.toBe(msg2.correlationId);
        expect(msg1.payload).toBe('payload-1');
        expect(msg2.payload).toBe('payload-2');

        broker.handleAgentMessage('conn-1', msg2.correlationId, 'response-2');
        broker.handleAgentMessage('conn-1', msg1.correlationId, 'response-1');

        await expect(p1).resolves.toBe('response-1');
        await expect(p2).resolves.toBe('response-2');
    });

    it('removeConnection clears handshake token so subsequent relay rejects', async () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        broker.removeConnection('conn-1');

        expect(broker.getHandshakeToken('conn-1')).toBeUndefined();
        await expect(broker.relay('conn-1', 'payload')).rejects.toThrow(/handshake not complete/);
    });

    it('ignores handshake with missing headerToken', () => {
        const { broker } = makeTestBroker();

        expect(() => {
            broker.handleAgentMessage('conn-1', 'handshake', { type: 'handshake' });
        }).not.toThrow();

        expect(broker.getHandshakeToken('conn-1')).toBeUndefined();
    });

    it('rejects when agent responds with non-string payload', async () => {
        const { sender, broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');

        const relayPromise = broker.relay('conn-1', 'payload', 100);
        const msg = (sender.sent[0] as (typeof sender.sent)[number]).message as SentPluginMessage;

        broker.handleAgentMessage('conn-1', msg.correlationId, { wrongType: true });

        await expect(relayPromise).rejects.toThrow(/Expected encrypted string/);
    });

    it('shutdown clears all handshake tokens', () => {
        const { broker } = makeTestBroker();
        doHandshake(broker, 'conn-1');
        doHandshake(broker, 'conn-2', 'token-2');

        broker.shutdown();

        expect(broker.getHandshakeToken('conn-1')).toBeUndefined();
        expect(broker.getHandshakeToken('conn-2')).toBeUndefined();
    });

    it('emits ReplActivity event after successful relay', async () => {
        const { sender, broker, dispatchedEvents } = makeTestBroker({
            resolveConnection: () => ({ clientId: 'c1', sessionId: 's1' }),
        });
        doHandshake(broker, 'conn-1');

        const relayPromise = broker.relay('conn-1', 'enc-request');
        const msg = (sender.sent[0] as (typeof sender.sent)[number]).message as SentPluginMessage;
        broker.handleAgentMessage('conn-1', msg.correlationId, 'enc-response');
        await relayPromise;

        expect(dispatchedEvents).toHaveLength(1);
        const event = dispatchedEvents[0];
        expect(event?.name).toBe('ReplActivity');
        expect(event?.body).toMatchObject({
            clientId: 'c1',
            sessionId: 's1',
            encryptedRequest: 'enc-request',
            encryptedResponse: 'enc-response',
        });
        if (event?.name === 'ReplActivity') {
            expect(typeof event.body.timestamp).toBe('number');
        }
    });

    it('does not emit ReplActivity when resolveConnection returns undefined', async () => {
        const { sender, broker, dispatchedEvents } = makeTestBroker({ resolveConnection: () => undefined });
        doHandshake(broker, 'conn-1');

        const relayPromise = broker.relay('conn-1', 'payload');
        const msg = (sender.sent[0] as (typeof sender.sent)[number]).message as SentPluginMessage;
        broker.handleAgentMessage('conn-1', msg.correlationId, 'response');
        await relayPromise;

        expect(dispatchedEvents).toHaveLength(0);
    });
});
