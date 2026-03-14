import { z } from 'zod';
import { router, procedure } from '../../../infra/trpc/trpc-setup';
import { type AppDependencies } from '../../../types/app-dependencies';

export function createSettingsRouter({ settingsRepository, eventDispatcher }: AppDependencies) {
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
                const updates: { maxTicksPerTree?: number; commandTimeoutMs?: number } = {};
                if (input.maxTicksPerTree !== undefined) updates.maxTicksPerTree = input.maxTicksPerTree;
                if (input.commandTimeoutMs !== undefined) updates.commandTimeoutMs = input.commandTimeoutMs;

                if (Object.keys(updates).length > 0) {
                    await settingsRepository.update(updates);
                }

                const settings = await settingsRepository.get();

                if (Object.keys(updates).length > 0) {
                    await eventDispatcher.dispatchServerEvent({
                        name: 'SettingsUpdated',
                        body: {
                            settings: {
                                maxTicksPerTree: settings.maxTicksPerTree,
                                commandTimeoutMs: settings.commandTimeoutMs,
                            },
                        },
                    });
                }

                return settings;
            }),
    });
}
