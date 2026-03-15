import { describe, it, expect } from 'vitest';
import { ReplBroker } from './repl-broker';
import { type CommandSenderInterface } from '../interfaces';

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
    payload: { type: string; code?: string; prefix?: string; maxResults?: number };
};

describe('ReplBroker', () => {
    it('sends eval request and resolves when agent responds', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const evalPromise = broker.sendEval('conn-1', '1 + 1');

        expect(sender.sent).toHaveLength(1);
        const msg = sender.sent[0].message as SentPluginMessage;
        expect(msg.t).toBe(7);
        expect(msg.pluginId).toBe('repl');
        expect(msg.payload.type).toBe('eval');
        expect(msg.payload.code).toBe('1 + 1');

        const result = { kind: 'result' as const, text: '2' };
        broker.handleAgentResponse(msg.correlationId, result);

        await expect(evalPromise).resolves.toEqual(result);
    });

    it('sends eval with error result', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const evalPromise = broker.sendEval('conn-1', 'throw new Error("oops")');
        const msg = sender.sent[0].message as SentPluginMessage;

        const result = { kind: 'error' as const, text: 'Error: oops' };
        broker.handleAgentResponse(msg.correlationId, result);

        await expect(evalPromise).resolves.toEqual(result);
    });

    it('sends completions request and resolves when agent responds', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const compPromise = broker.sendCompletions('conn-1', 'Math.');

        expect(sender.sent).toHaveLength(1);
        const msg = sender.sent[0].message as SentPluginMessage;
        expect(msg.pluginId).toBe('repl');
        expect(msg.payload.type).toBe('completions');
        expect(msg.payload.prefix).toBe('Math.');

        const result = { completions: ['Math.abs', 'Math.floor'] };
        broker.handleAgentResponse(msg.correlationId, result);

        await expect(compPromise).resolves.toEqual(result);
    });

    it('passes maxResults through to completions payload', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const compPromise = broker.sendCompletions('conn-1', 'obj.', 10);
        const msg = sender.sent[0].message as SentPluginMessage;
        expect(msg.payload.maxResults).toBe(10);

        broker.handleAgentResponse(msg.correlationId, { completions: [] });
        await expect(compPromise).resolves.toEqual({ completions: [] });
    });

    it('rejects on timeout', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const evalPromise = broker.sendEval('conn-1', 'code', 20);
        await expect(evalPromise).rejects.toThrow(/timed out/);
    });

    it('rejects all pending on shutdown', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const evalPromise = broker.sendEval('conn-1', 'code');
        broker.shutdown();

        await expect(evalPromise).rejects.toThrow(/shutting down/);
    });

    it('logs warning for unknown correlationId without throwing', () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        expect(() => broker.handleAgentResponse('unknown-id', {})).not.toThrow();
    });

    it('handles multiple concurrent requests independently', async () => {
        const sender = new FakeCommandSender();
        const broker = new ReplBroker(sender);

        const p1 = broker.sendEval('conn-1', '1 + 1');
        const p2 = broker.sendEval('conn-1', '2 + 2');

        expect(sender.sent).toHaveLength(2);
        const msg1 = sender.sent[0].message as SentPluginMessage;
        const msg2 = sender.sent[1].message as SentPluginMessage;
        expect(msg1.correlationId).not.toBe(msg2.correlationId);

        broker.handleAgentResponse(msg2.correlationId, { kind: 'result' as const, text: '4' });
        broker.handleAgentResponse(msg1.correlationId, { kind: 'result' as const, text: '2' });

        await expect(p1).resolves.toEqual({ kind: 'result', text: '2' });
        await expect(p2).resolves.toEqual({ kind: 'result', text: '4' });
    });
});
