import { z } from 'zod';
import { router, procedure } from './trpc-setup';
import { AppDependencies } from '../../types/app-dependencies';
import { TickRecordSchema } from '../../domain/core-types';

export function createTicksRouter({ tickRepository }: AppDependencies) {
    return router({
        query: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
                afterTickId: z.number().int().default(0),
                limit: z.number().int().min(1).max(1000).default(100),
            }))
            .output(z.array(TickRecordSchema))
            .query(async ({ input }) => {
                return tickRepository.findAfter(
                    input.clientId,
                    input.sessionId,
                    input.treeId,
                    input.afterTickId,
                    input.limit
                );
            }),
    });
}
