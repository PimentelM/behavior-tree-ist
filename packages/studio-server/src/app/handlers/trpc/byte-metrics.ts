import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';

const ByteSampleSchema = z.object({
    tickId: z.number().int(),
    bytes: z.number().int(),
});

export function createByteMetricsRouter({ byteMetricsService }: AppDependencies) {
    return router({
        query: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
            }))
            .output(z.object({
                samples: z.array(ByteSampleSchema),
                ratePerSecond: z.number(),
                totalBytes: z.number(),
            }))
            // eslint-disable-next-line @typescript-eslint/require-await
            .query(async ({ input }) => {
                return byteMetricsService.query(input.clientId, input.sessionId, input.treeId);
            }),
    });
}
