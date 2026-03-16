import { UiMessageType } from '@bt-studio/studio-common';
import type { AppDependencies } from '../../../types';
import type { RuntimeSettingsRef } from '../messages/tick-batch-handler';

export function registerLocalDomainEventHandlers({
    uiWsServer,
    eventDispatcher,
    commandBroker,
    byteMetricsService,
    runtimeSettings,
}: Pick<AppDependencies, 'uiWsServer' | 'eventDispatcher' | 'commandBroker' | 'byteMetricsService'> & { runtimeSettings: RuntimeSettingsRef }): void {
    // eslint-disable-next-line @typescript-eslint/require-await
    eventDispatcher.on('Agent', 'AgentConnected', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.AgentOnline,
            clientId,
            sessionId,
        });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    eventDispatcher.on('Agent', 'AgentDisconnected', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.AgentOffline,
            clientId,
            sessionId,
        });

        byteMetricsService.clearByAgent(clientId, sessionId);
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    eventDispatcher.on('Agent', 'CatalogChanged', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.CatalogChanged,
            clientId,
            sessionId,
        });
    });

    // eslint-disable-next-line @typescript-eslint/require-await
    eventDispatcher.on('Server', 'SettingsUpdated', async ({ event }) => {
        const { maxTicksPerTree, commandTimeoutMs } = event.body.settings;
        runtimeSettings.maxTicksPerTree = maxTicksPerTree;
        commandBroker.updateTimeoutMs(commandTimeoutMs);
    });
}
