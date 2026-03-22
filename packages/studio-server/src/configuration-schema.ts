import { z } from 'zod';

export const StudioServerConfigSchema = z.object({
    http: z.object({
        port: z.number().int().min(1).max(65535),
        host: z.string().min(1),
    }),
    tcp: z.object({
        port: z.number().int().min(1).max(65535),
        host: z.string().min(1),
    }),
    ws: z.object({
        path: z.string().min(1),
    }),
    uiWs: z.object({
        path: z.string().min(1),
    }),
    sqlite: z.object({
        path: z.string().min(1),
    }),
    commandTimeoutMs: z.number().int().min(1),
    maxTicksPerTree: z.number().int().min(1),
    maxConnections: z.number().int().min(1).default(1000),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']),
    migrations: z.object({
        runOnStartup: z.boolean(),
    }),
});

export type StudioServerConfig = z.infer<typeof StudioServerConfigSchema>;

export function parseStudioServerConfig(config: unknown): StudioServerConfig {
    const parsed = StudioServerConfigSchema.safeParse(config);
    if (parsed.success) {
        return parsed.data;
    }

    const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');

    throw new Error(`Invalid studio server configuration: ${details}`);
}
