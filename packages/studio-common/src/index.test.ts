import { describe, it, expect } from 'vitest';
import {
    MessageTypeSchema,
    StudioCommandTypeSchema,
    OutboundMessageSchema,
    InboundMessageSchema,
    TickRecordSchema,
    SerializableNodeSchema,
    TreeStatusesSchema,
} from './core-schemas';
import { ClientRecord, SessionRecord, SettingsRecord } from './records';
import { ServerSettings, TickBounds } from './types';
import { UiInboundMessageSchema, UiOutboundMessageSchema } from './protocol';

// MessageType numeric values from @bt-studio/core (kept as literals to avoid requiring built dist)
const T_Hello = 1;
const T_TickBatch = 4;
const T_Command = 6;
const T_PluginMessage = 7;
const CMD_EnableStreaming = 1;  // StudioCommandType.EnableStreaming
const CMD_GetTreeStatuses = 7;  // StudioCommandType.GetTreeStatuses

describe('MessageTypeSchema', () => {
    it('accepts valid message types', () => {
        expect(MessageTypeSchema.parse(T_Hello)).toBe(T_Hello);
        expect(MessageTypeSchema.parse(T_TickBatch)).toBe(T_TickBatch);
        expect(MessageTypeSchema.parse(T_PluginMessage)).toBe(T_PluginMessage);
    });

    it('rejects invalid message type', () => {
        expect(() => MessageTypeSchema.parse(999)).toThrow();
    });
});

describe('StudioCommandTypeSchema', () => {
    it('accepts valid command types', () => {
        expect(StudioCommandTypeSchema.parse(CMD_EnableStreaming)).toBe(CMD_EnableStreaming);
        expect(StudioCommandTypeSchema.parse(CMD_GetTreeStatuses)).toBe(CMD_GetTreeStatuses);
    });

    it('rejects invalid command type', () => {
        expect(() => StudioCommandTypeSchema.parse('unknown')).toThrow();
    });
});

describe('RefChangeEventSchema', () => {
    it('parses event with newValue (no displayValue)', () => {
        const event = {
            tickId: 1,
            timestamp: 100,
            refName: 'counter',
            nodeId: 5,
            newValue: 42,
            isAsync: false,
        };
        const parsed = TickRecordSchema.parse({ tickId: 1, timestamp: 100, events: [], refEvents: [event] });
        const refEvent = parsed.refEvents[0]!;
        expect(refEvent.newValue).toBe(42);
        expect(refEvent.displayValue).toBeUndefined();
    });

    it('parses event with displayValue (no newValue)', () => {
        const event = {
            tickId: 2,
            timestamp: 200,
            refName: 'enemy',
            isAsync: false,
            displayValue: 'Orc (hp: 200)',
        };
        const parsed = TickRecordSchema.parse({ tickId: 2, timestamp: 200, events: [], refEvents: [event] });
        const refEvent = parsed.refEvents[0]!;
        expect(refEvent.displayValue).toBe('Orc (hp: 200)');
        expect(refEvent.newValue).toBeUndefined();
    });
});

describe('TickRecordSchema', () => {
    it('parses a minimal tick record', () => {
        const record = {
            tickId: 1,
            timestamp: 1000,
            events: [],
            refEvents: [],
        };
        const parsed = TickRecordSchema.parse(record);
        expect(parsed.tickId).toBe(1);
        expect(parsed.events).toEqual([]);
    });

    it('rejects missing required fields', () => {
        expect(() => TickRecordSchema.parse({ tickId: 1 })).toThrow();
    });

    it('rejects non-integer tickId', () => {
        expect(() => TickRecordSchema.parse({ tickId: 1.5, timestamp: 0, events: [], refEvents: [] })).toThrow();
    });
});

describe('SerializableNodeSchema', () => {
    it('parses a leaf node', () => {
        const node = {
            id: 1,
            nodeFlags: 0,
            defaultName: 'Action',
            name: 'MyAction',
        };
        const parsed = SerializableNodeSchema.parse(node);
        expect(parsed.id).toBe(1);
        expect(parsed.children).toBeUndefined();
    });

    it('parses a composite node with children', () => {
        const node = {
            id: 1,
            nodeFlags: 0,
            defaultName: 'Sequence',
            name: 'Root',
            children: [
                { id: 2, nodeFlags: 0, defaultName: 'Action', name: 'A' },
            ],
        };
        const parsed = SerializableNodeSchema.parse(node);
        expect(parsed.children).toHaveLength(1);
        expect(parsed.children?.[0]?.id).toBe(2);
    });
});

describe('OutboundMessageSchema', () => {
    it('parses Hello message', () => {
        const msg = { t: T_Hello, version: 1, clientId: 'c1', sessionId: 's1' };
        const parsed = OutboundMessageSchema.parse(msg);
        expect(parsed.t).toBe(T_Hello);
    });

    it('parses TickBatch message', () => {
        const msg = { t: T_TickBatch, treeId: 'tree1', ticks: [] };
        const parsed = OutboundMessageSchema.parse(msg);
        expect(parsed.t).toBe(T_TickBatch);
    });

    it('parses PluginMessage', () => {
        const msg = { t: T_PluginMessage, pluginId: 'repl', correlationId: 'abc', payload: { type: 'handshake' } };
        const parsed = OutboundMessageSchema.parse(msg);
        expect(parsed.t).toBe(T_PluginMessage);
    });

    it('rejects unknown message type', () => {
        expect(() => OutboundMessageSchema.parse({ t: 999 })).toThrow();
    });
});

describe('InboundMessageSchema', () => {
    it('parses Command message', () => {
        const msg = {
            t: T_Command,
            command: { correlationId: 'corr1', treeId: 'tree1', command: CMD_EnableStreaming },
        };
        const parsed = InboundMessageSchema.parse(msg);
        expect(parsed.t).toBe(T_Command);
    });

    it('parses PluginMessage', () => {
        const msg = { t: T_PluginMessage, pluginId: 'repl', correlationId: 'abc', payload: 'encrypted-blob' };
        const parsed = InboundMessageSchema.parse(msg);
        expect(parsed.t).toBe(T_PluginMessage);
    });
});

describe('TreeStatusesSchema', () => {
    it('parses valid statuses', () => {
        const s = TreeStatusesSchema.parse({ streaming: true, stateTrace: false, profiling: true });
        expect(s.streaming).toBe(true);
    });

    it('rejects extra fields', () => {
        expect(() => TreeStatusesSchema.parse({ streaming: true, stateTrace: false, profiling: true, extra: 'x' })).toThrow();
    });
});

describe('ClientRecord', () => {
    it('parses valid record', () => {
        const r = ClientRecord.parse({ clientId: 'c1', firstSeenAt: 0, lastSeenAt: 1 });
        expect(r.clientId).toBe('c1');
    });

    it('rejects missing fields', () => {
        expect(() => ClientRecord.parse({ clientId: 'c1' })).toThrow();
    });
});

describe('SessionRecord', () => {
    it('parses valid record', () => {
        const r = SessionRecord.parse({ clientId: 'c1', sessionId: 's1', startedAt: 0, lastSeenAt: 1 });
        expect(r.sessionId).toBe('s1');
    });
});

describe('SettingsRecord', () => {
    it('parses valid record', () => {
        const r = SettingsRecord.parse({ id: 1, maxTicksPerTree: 100000, commandTimeoutMs: 5000, updatedAt: 0 });
        expect(r.maxTicksPerTree).toBe(100000);
    });

    it('rejects non-integer values', () => {
        expect(() => SettingsRecord.parse({ id: 1.5, maxTicksPerTree: 100000, commandTimeoutMs: 5000, updatedAt: 0 })).toThrow();
    });
});

describe('ServerSettings', () => {
    it('parses valid settings', () => {
        const s = ServerSettings.parse({ maxTicksPerTree: 1000, commandTimeoutMs: 3000 });
        expect(s.maxTicksPerTree).toBe(1000);
    });
});

describe('TickBounds', () => {
    it('parses valid bounds', () => {
        const b = TickBounds.parse({ minTickId: 1, maxTickId: 100, totalCount: 100 });
        expect(b.totalCount).toBe(100);
    });

    it('rejects missing totalCount', () => {
        expect(() => TickBounds.parse({ minTickId: 1, maxTickId: 100 })).toThrow();
    });
});

describe('UiProtocol', () => {
    it('parses ping outbound message', () => {
        const msg = UiOutboundMessageSchema.parse({ t: 'ping' });
        expect(msg.t).toBe('ping');
    });

    it('rejects extra fields on ping', () => {
        expect(() => UiOutboundMessageSchema.parse({ t: 'ping', extra: 1 })).toThrow();
    });

    it('parses AgentOnline inbound message', () => {
        const msg = UiInboundMessageSchema.parse({ t: 'agent.online', clientId: 'c1', sessionId: 's1' });
        expect(msg.t).toBe('agent.online');
    });

    it('parses CatalogChanged inbound message', () => {
        const msg = UiInboundMessageSchema.parse({ t: 'catalog.changed', clientId: 'c1', sessionId: 's1' });
        expect(msg.t).toBe('catalog.changed');
    });

    it('rejects unknown inbound type', () => {
        expect(() => UiInboundMessageSchema.parse({ t: 'unknown', clientId: 'c1', sessionId: 's1' })).toThrow();
    });
});
