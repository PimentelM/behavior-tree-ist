import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';
import { DEFAULT_EVAL_TIMEOUT_MS, DEFAULT_COMPLETIONS_TIMEOUT_MS } from '../../services/repl-broker';

export function createReplRouter({ replBroker, agentConnectionRegistry }: AppDependencies) {
    return router({
        handshake: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
            }))
            .query(({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }
                const headerToken = replBroker.getHandshakeToken(connection.connectionId);
                if (!headerToken) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `No handshake token available for ${input.clientId}:${input.sessionId}`,
                    });
                }
                return { headerToken };
            }),

        eval: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                encryptedPayload: z.string(),
            }))
            .mutation(async ({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }
                const encryptedPayload = await replBroker.relay(
                    connection.connectionId,
                    input.encryptedPayload,
                    DEFAULT_EVAL_TIMEOUT_MS,
                );
                return { encryptedPayload };
            }),

        completions: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                encryptedPayload: z.string(),
            }))
            .mutation(async ({ input }) => {
                const connection = agentConnectionRegistry.getByIdentity(input.clientId, input.sessionId);
                if (!connection) {
                    throw new TRPCError({
                        code: 'NOT_FOUND',
                        message: `Agent ${input.clientId}:${input.sessionId} is not connected`,
                    });
                }
                const encryptedPayload = await replBroker.relay(
                    connection.connectionId,
                    input.encryptedPayload,
                    DEFAULT_COMPLETIONS_TIMEOUT_MS,
                );
                return { encryptedPayload };
            }),
    });
}
