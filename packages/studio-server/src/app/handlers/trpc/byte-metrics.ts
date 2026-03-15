import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';

const ByteSampleSchema = z.object({
    tickId: z.number(),
    bytes: z.number(),
    timestamp: z.number(),
});

const ByteMetricsSummarySchema = z.object({
    rate: z.number(),
    totalBytes: z.number(),
    samples: z.array(ByteSampleSchema),
});

export function createByteMetricsRouter({ byteMetricsService }: AppDependencies) {
    return router({
        perTree: procedure
            .input(z.object({
                clientId: z.string(),
                sessionId: z.string(),
                treeId: z.string(),
            }))
            .output(ByteMetricsSummarySchema)
            .query(({ input }) => {
                return byteMetricsService.query(input.clientId, input.sessionId, input.treeId);
            }),
    });
}
