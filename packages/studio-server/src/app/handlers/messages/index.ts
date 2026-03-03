import { MessageType } from '@behavior-tree-ist/core';
import { AppDependencies } from '../../../types/app-dependencies';
import { HelloHandler } from './hello-handler';
import { TreeRegisteredHandler } from './tree-registered-handler';
import { TreeRemovedHandler } from './tree-removed-handler';
import { TickBatchHandler } from './tick-batch-handler';
import { CommandResponseHandler } from './command-response-handler';
import { AgentConnectionRegistryInterface } from '../../../domain/interfaces';
import { createLogger } from '../../../infra/logging';

export function registerMessageHandlers({ messageRouter, ...deps }: AppDependencies) {
    messageRouter.registerHandler(
        MessageType.Hello,
        new HelloHandler({
            clientRepository: deps.clientRepository,
            sessionRepository: deps.sessionRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
        })
    );

    messageRouter.registerHandler(
        MessageType.TreeRegistered,
        new TreeRegisteredHandler({
            treeRepository: deps.treeRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
        })
    );

    messageRouter.registerHandler(
        MessageType.TreeRemoved,
        new TreeRemovedHandler({
            treeRepository: deps.treeRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
        })
    );

    messageRouter.registerHandler(
        MessageType.TickBatch,
        new TickBatchHandler({
            tickRepository: deps.tickRepository,
            agentConnectionRegistry: deps.agentConnectionRegistry,
            settingsRepository: deps.settingsRepository,
        })
    );

    messageRouter.registerHandler(
        MessageType.CommandResponse,
        new CommandResponseHandler({
            commandBroker: deps.commandBroker,
        })
    );
}

export function createDisconnectHandler(deps: { agentConnectionRegistry: AgentConnectionRegistryInterface }) {
    const logger = createLogger('disconnect-handler');

    return (connectionId: string) => {
        const connection = deps.agentConnectionRegistry.unregisterByConnectionId(connectionId);
        if (connection) {
            logger.info('Agent disconnected', {
                clientId: connection.clientId,
                sessionId: connection.sessionId,
                connectionId,
            });
        }
    };
}
