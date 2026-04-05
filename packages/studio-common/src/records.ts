import { z } from 'zod';
import { SerializableNodeSchema } from './core-schemas';

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
    serializedTree: SerializableNodeSchema,
    removedAt: z.number().optional(),
    updatedAt: z.number(),
});
export type TreeRecord = z.infer<typeof TreeRecord>;

export const SettingsRecord = z.object({
    id: z.number().int(),
    maxTicksPerTree: z.number().int(),
    commandTimeoutMs: z.number().int(),
    updatedAt: z.number(),
});
export type SettingsRecord = z.infer<typeof SettingsRecord>;

export const LogLevelSchema = z.number().int().min(0).max(4);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogRecord = z.object({
    id: z.number().int(),
    clientId: z.string(),
    sessionId: z.string(),
    timestamp: z.number(),
    level: LogLevelSchema,
    event: z.string(),
    message: z.string(),
});
export type LogRecord = z.infer<typeof LogRecord>;
