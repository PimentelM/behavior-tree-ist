import z from "zod";

export const ServerSettings = z.object({
    maxTicksPerTree: z.number().int(),
    commandTimeoutMs: z.number().int(),
});
export type ServerSettings = z.infer<typeof ServerSettings>;
