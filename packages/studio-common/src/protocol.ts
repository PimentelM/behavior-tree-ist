import { z } from 'zod';

export const UiMessageType = {
    AgentOnline: 'agent.online',
    AgentOffline: 'agent.offline',
    CatalogChanged: 'catalog.changed',
    ReplActivity: 'repl.activity',
} as const;

export type UiMessageType = typeof UiMessageType[keyof typeof UiMessageType];

export const UiMessageTypeSchema = z.union([
    z.literal(UiMessageType.AgentOnline),
    z.literal(UiMessageType.AgentOffline),
    z.literal(UiMessageType.CatalogChanged),
    z.literal(UiMessageType.ReplActivity),
]);

// UI -> Server
// Initially no outbound messages exist in the minimal protocol. Zod requires at least one type in a union,
// or we can define it as a generic Ping if needed, but for now we'll define a placeholder 'Ping'.
export const UiOutboundMessageSchema = z.object({
    t: z.literal('ping'),
}).strict();

export type UiOutboundMessage = z.infer<typeof UiOutboundMessageSchema>;

// Server -> UI
export const UiInboundMessageSchema = z.union([
    z.object({
        t: z.literal(UiMessageType.AgentOnline),
        clientId: z.string(),
        sessionId: z.string(),
    }).strict(),
    z.object({
        t: z.literal(UiMessageType.AgentOffline),
        clientId: z.string(),
        sessionId: z.string(),
    }).strict(),
    z.object({
        t: z.literal(UiMessageType.CatalogChanged),
        clientId: z.string(),
        sessionId: z.string(),
    }).strict(),
    z.object({
        t: z.literal(UiMessageType.ReplActivity),
        clientId: z.string(),
        sessionId: z.string(),
        encryptedRequest: z.string(),
        encryptedResponse: z.string(),
        timestamp: z.number(),
    }).strict(),
]);

export type UiInboundMessage = z.infer<typeof UiInboundMessageSchema>;
