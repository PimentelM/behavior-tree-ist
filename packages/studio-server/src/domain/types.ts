import z from "zod";

export interface AgentConnection {
    connectionId: string;
    clientId: string;
    sessionId: string;
    connectedAt: number;
}

export const ServerSettings = z.object({
    maxTicksPerTree: z.number().int(),
    commandTimeoutMs: z.number().int(),
});
export type ServerSettings = z.infer<typeof ServerSettings>;