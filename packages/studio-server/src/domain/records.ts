import { z } from 'zod';

export const ClientRecord = z.object({
    clientId: z.string(),
    firstSeenAt: z.number(),
    lastSeenAt: z.number(),
});
export type ClientRecord = z.infer<typeof ClientRecord>;

export const SessionRecord = z.object({
    clientId: z.string(),
    sessionId: z.string(),
    startedAt: z.number(),
    lastSeenAt: z.number(),
});
export type SessionRecord = z.infer<typeof SessionRecord>;

export const TreeRecord = z.object({
    clientId: z.string(),
    sessionId: z.string(),
    treeId: z.string(),
    serializedTreeJson: z.string(),
    removedAt: z.number().optional(),
    updatedAt: z.number(),
});
export type TreeRecord = z.infer<typeof TreeRecord>;

export const TickRecord = z.object({
    clientId: z.string(),
    sessionId: z.string(),
    treeId: z.string(),
    tickId: z.number().int(),
    timestamp: z.number(),
    payloadJson: z.string(),
});
export type TickRecord = z.infer<typeof TickRecord>;

export const SettingsRecord = z.object({
    id: z.number().int(),
    maxTicksPerTree: z.number().int(),
    commandTimeoutMs: z.number().int(),
    updatedAt: z.number(),
});
export type SettingsRecord = z.infer<typeof SettingsRecord>;
