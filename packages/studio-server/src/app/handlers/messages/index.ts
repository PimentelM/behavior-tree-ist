import { MessageType } from '@bt-studio/core';
import { type AppDependencies } from '../../../types/app-dependencies';
import { HelloHandler } from './hello-handler';
import { TreeRegisteredHandler } from './tree-registered-handler';
import { TreeRemovedHandler } from './tree-removed-handler';
import { TickBatchHandler, type RuntimeSettingsRef } from './tick-batch-handler';
import { CommandResponseHandler } from './command-response-handler';
import { PluginMessageHandler } from './plugin-message-handler';
import { createLogger } from '../../../infra/logging';

export type { RuntimeSettingsRef };

export function registerMessageHandlers({ messageRouter, ...deps }: AppDependencies, runtimeSettings: RuntimeSettingsRef) {
    messageRouter.registerHandler(
        MessageType.Hello,
        new HelloHandler({
            clientRepository: deps.clientRepository,
            sessionRepository: deps.sessionRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
            eventDispatcher: deps.eventDispatcher,
        })
    );

    messageRouter.registerHandler(
        MessageType.TreeRegistered,
        new TreeRegisteredHandler({
            treeRepository: deps.treeRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
            eventDispatcher: deps.eventDispatcher,
        })
    );

    messageRouter.registerHandler(
        MessageType.TreeRemoved,
        new TreeRemovedHandler({
            treeRepository: deps.treeRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
            eventDispatcher: deps.eventDispatcher,
        })
    );

    messageRouter.registerHandler(
        MessageType.TickBatch,
        new TickBatchHandler({
            tickRepository: deps.tickRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
            runtimeSettings,
            byteMetricsService: deps.byteMetricsService,
        })
    );

    messageRouter.registerHandler(
        MessageType.CommandResponse,
        new CommandResponseHandler({
            commandBroker: deps.commandBroker,
        })
    );

    messageRouter.registerHandler(
        MessageType.PluginMessage,
        new PluginMessageHandler({
            replBroker: deps.replBroker,
        })
    );
}

export function createDisconnectHandler(deps: Pick<AppDependencies, 'agentConnectionRegistry' | 'eventDispatcher'>) {
    const logger = createLogger('disconnect-handler');

    return (connectionId: string) => {
        const connection = deps.agentConnectionRegistry.unregisterByConnectionId(connectionId);
        if (connection) {
            logger.info('Agent disconnected', {
                clientId: connection.clientId,
                sessionId: connection.sessionId,
                connectionId,
            });

            void deps.eventDispatcher.dispatchAgentEvent({
                name: 'AgentDisconnected',
                body: {
                    clientId: connection.clientId,
                    sessionId: connection.sessionId,
                },
            });
        }
    };
}
