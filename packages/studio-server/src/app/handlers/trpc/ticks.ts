import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { AppDependencies } from '../../../types/app-dependencies';
import { TickRecordSchema } from '../../../domain/core-schemas';

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

        queryBefore: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
                beforeTickId: z.number().int(),
                limit: z.number().int().min(1).max(1000).default(100),
            }))
            .output(z.array(TickRecordSchema))
            .query(async ({ input }) => {
                return tickRepository.findBefore(
                    input.clientId,
                    input.sessionId,
                    input.treeId,
                    input.beforeTickId,
                    input.limit
                );
            }),

        range: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
                fromTickId: z.number().int(),
                toTickId: z.number().int(),
                limit: z.number().int().min(1).max(10000).optional(),
            }))
            .output(z.array(TickRecordSchema))
            .query(async ({ input }) => {
                return tickRepository.findRange(
                    input.clientId,
                    input.sessionId,
                    input.treeId,
                    input.fromTickId,
                    input.toTickId,
                    input.limit
                );
            }),

        bounds: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
            }))
            .query(async ({ input }) => {
                return tickRepository.getTickBounds(
                    input.clientId,
                    input.sessionId,
                    input.treeId
                );
            }),
    });
}
