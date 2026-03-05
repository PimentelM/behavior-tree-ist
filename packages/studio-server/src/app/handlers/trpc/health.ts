import { router, procedure } from '../../../infra/trpc/trpc-setup';

export function createHealthRouter() {
    return router({
        check: procedure.query(() => ({
            status: 'ok' as const,
            timestamp: Date.now(),
            uptime: process.uptime(),
        })),
    });
}
