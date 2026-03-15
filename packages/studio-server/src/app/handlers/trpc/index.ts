import { router } from '../../../infra/trpc/trpc-setup';
import { createHealthRouter } from './health';
import { createClientsRouter } from './clients';
import { createSessionsRouter } from './sessions';
import { createTreesRouter } from './trees';
import { createTicksRouter } from './ticks';
import { createCommandsRouter } from './commands';
import { createSettingsRouter } from './settings';
import { createByteMetricsRouter } from './byte-metrics';
import { type AppDependencies } from '../../../types/app-dependencies';

export function createAppRouter(deps: AppDependencies) {
    return router({
        health: createHealthRouter(),
        clients: createClientsRouter(deps),
        sessions: createSessionsRouter(deps),
        trees: createTreesRouter(deps),
        ticks: createTicksRouter(deps),
        commands: createCommandsRouter(deps),
        settings: createSettingsRouter(deps),
        byteMetrics: createByteMetricsRouter(deps),
    });
}

export type AppRouter = ReturnType<typeof createAppRouter>;
