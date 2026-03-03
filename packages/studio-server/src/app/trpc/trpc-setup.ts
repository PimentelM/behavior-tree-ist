import { initTRPC } from '@trpc/server';
import { AppDependencies } from '../../types/app-dependencies';
import { createLogger } from '../../infra/logging';

export type TRPCContext = AppDependencies;

const t = initTRPC.context<TRPCContext>().create({
    isDev: process.env.NODE_ENV !== 'production',
});

const logger = createLogger('trpc');

const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
    const start = Date.now();

    try {
        const result = await next();
        const duration = Date.now() - start;
        logger.debug('Request completed', { path, type, duration });
        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('Request failed', {
            path,
            type,
            duration,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
});

export const router = t.router;
export const procedure = t.procedure.use(loggerMiddleware);
