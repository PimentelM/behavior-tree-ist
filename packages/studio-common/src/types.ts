import z from "zod";

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
