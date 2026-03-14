import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';
import { TreeRecord } from '../../../domain/records';

export function createTreesRouter({ treeRepository }: AppDependencies) {
    return router({
        getBySession: procedure
            .input(z.object({ clientId: z.string(), sessionId: z.string() }))
            .output(z.array(TreeRecord))
            .query(async ({ input }) => {
                return treeRepository.findBySession(input.clientId, input.sessionId);
            }),

        getById: procedure
            .input(z.object({ clientId: z.string(), sessionId: z.string(), treeId: z.string() }))
            .output(TreeRecord.nullable())
            .query(async ({ input }) => {
                return await treeRepository.findById(input.clientId, input.sessionId, input.treeId) ?? null;
            }),
    });
}
