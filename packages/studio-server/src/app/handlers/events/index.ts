import { UiMessageType } from '@behavior-tree-ist/studio-common';
import type { AppDependencies } from '../../../types';

export function registerLocalDomainEventHandlers({
    uiWsServer,
    eventDispatcher,
}: Pick<AppDependencies, 'uiWsServer' | 'eventDispatcher'>): void {
    eventDispatcher.on('Agent', 'AgentConnected', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.AgentOnline,
            clientId,
            sessionId,
        });
    });

    eventDispatcher.on('Agent', 'AgentDisconnected', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.AgentOffline,
            clientId,
            sessionId,
        });
    });

    eventDispatcher.on('Agent', 'CatalogChanged', async ({ event }) => {
        const { clientId, sessionId } = event.body;

        uiWsServer.broadcast({
            t: UiMessageType.CatalogChanged,
            clientId,
            sessionId,
        });
    });
}
