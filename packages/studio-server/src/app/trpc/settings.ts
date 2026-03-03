import { z } from 'zod';
import { router, procedure } from './trpc-setup';
import { AppDependencies } from '../../types/app-dependencies';

export function createSettingsRouter({ settingsRepository }: AppDependencies) {
    return router({
        get: procedure.query(async () => {
            return settingsRepository.get();
        }),

        update: procedure
            .input(z.object({
                maxTicksPerTree: z.number().int().min(1).optional(),
                commandTimeoutMs: z.number().int().min(100).optional(),
            }))
            .mutation(async ({ input }) => {
                const updates: Record<string, number> = {};
                if (input.maxTicksPerTree !== undefined) updates.max_ticks_per_tree = input.maxTicksPerTree;
                if (input.commandTimeoutMs !== undefined) updates.command_timeout_ms = input.commandTimeoutMs;

                if (Object.keys(updates).length > 0) {
                    await settingsRepository.update(updates as { max_ticks_per_tree?: number; command_timeout_ms?: number });
                }

                return settingsRepository.get();
            }),
    });
}
