import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { StudioCommandType } from '@behavior-tree-ist/core';
import { v4 as uuidv4 } from 'uuid';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { AppDependencies } from '../../../types/app-dependencies';

export function createCommandsRouter({ commandBroker, agentConnectionRegistry }: AppDependencies) {
    return router({
        send: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
                command: z.number().int(),
            }))
            .mutation(async ({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }

                const response = await commandBroker.sendCommand(connection.connectionId, {
                    correlationId: uuidv4(),
                    treeId: input.treeId,
                    command: input.command as StudioCommandType,
                });

                return response;
            }),
    });
}
