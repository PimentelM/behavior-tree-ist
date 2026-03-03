import { router, procedure } from './trpc-setup';

export function createHealthRouter() {
    return router({
        check: procedure.query(() => ({
            status: 'ok' as const,
            timestamp: Date.now(),
            uptime: process.uptime(),
        })),
    });
}
