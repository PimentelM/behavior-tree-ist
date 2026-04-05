import { LogQuery } from '@bt-studio/studio-common';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';

export function createLogsRouter({ logRepository }: AppDependencies) {
    return router({
        query: procedure
            .input(LogQuery)
            .query(async ({ input }) => {
                const limit = Math.min(input.limit ?? 100, 500);
                return logRepository.query({ ...input, limit });
            }),
    });
}
