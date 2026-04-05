import z from "zod";
import { LogLevelSchema, LogRecord } from './records';

export const ServerSettings = z.object({
    maxTicksPerTree: z.number().int(),
    commandTimeoutMs: z.number().int(),
});
export type ServerSettings = z.infer<typeof ServerSettings>;

export const TickBounds = z.object({
    minTickId: z.number().int(),
    maxTickId: z.number().int(),
    totalCount: z.number().int(),
});
export type TickBounds = z.infer<typeof TickBounds>;

export const LogQuery = z.object({
    clientId: z.string(),
    sessionId: z.string().optional(),
    minLevel: LogLevelSchema.optional(),
    beforeId: z.number().int().positive().optional(),
    limit: z.number().int().positive().max(500).optional(),
});
export type LogQuery = z.infer<typeof LogQuery>;

export const LogQueryPage = z.object({
    items: z.array(LogRecord),
    nextCursor: z.number().int().positive().nullable(),
});
export type LogQueryPage = z.infer<typeof LogQueryPage>;
