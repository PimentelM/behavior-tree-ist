import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';

export function createReplRouter({ replBroker, agentConnectionRegistry }: AppDependencies) {
    return router({
        eval: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                code: z.string(),
            }))
            .mutation(async ({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }
                return replBroker.sendEval(connection.connectionId, input.code);
            }),

        completions: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                prefix: z.string(),
                maxResults: z.number().int().min(1).max(200).optional(),
            }))
            .mutation(async ({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }
                return replBroker.sendCompletions(connection.connectionId, input.prefix, input.maxResults);
            }),
    });
}
