import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type TreeRepositoryInterface } from '../../../domain/interfaces';
import { type AgentConnectionRegistryInterface, type DomainEventDispatcherInterface } from '../../interfaces';

interface TreeRegisteredHandlerDeps {
    treeRepository: TreeRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    eventDispatcher: DomainEventDispatcherInterface;
}

export class TreeRegisteredHandler extends BaseHandler {
    constructor(private deps: TreeRegisteredHandlerDeps, priority = 100) {
        super(priority, 'tree-registered-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        if (message.t !== MessageType.TreeRegistered) return;

        const connection = this.deps.agentConnectionRegistry.getByConnectionId(client.id);

        if (!connection) {
            this.logger.warn('TreeRegistered from unknown client', { connectionId: client.id, transport: client.transport });
            return;
        }

        const { clientId, sessionId } = connection;
        await this.deps.treeRepository.upsert(
            clientId,
            sessionId,
            message.treeId,
            message.serializedTree
        );
        await this.deps.eventDispatcher.dispatchAgentEvent({
            name: 'CatalogChanged',
            body: { clientId, sessionId },
        });

        this.logger.debug('Tree registered', { clientId, sessionId, treeId: message.treeId });
    }
}
