import { z } from 'zod';
import { router, procedure } from './trpc-setup';
import { AppDependencies } from '../../types/app-dependencies';

export function createTreesRouter({ treeRepository }: AppDependencies) {
    return router({
        getBySession: procedure
            .input(z.object({ clientId: z.string(), sessionId: z.string() }))
            .query(async ({ input }) => {
                return treeRepository.findBySession(input.clientId, input.sessionId);
            }),

        getById: procedure
            .input(z.object({ clientId: z.string(), sessionId: z.string(), treeId: z.string() }))
            .query(async ({ input }) => {
                return treeRepository.findById(input.clientId, input.sessionId, input.treeId) ?? null;
            }),
    });
}
