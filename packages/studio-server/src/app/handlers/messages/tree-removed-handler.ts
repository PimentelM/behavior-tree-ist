import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type TreeRepositoryInterface } from '../../../domain/interfaces';
import { type AgentConnectionRegistryInterface, type DomainEventDispatcherInterface } from '../../interfaces';

interface TreeRemovedHandlerDeps {
    treeRepository: TreeRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    eventDispatcher: DomainEventDispatcherInterface;
}

export class TreeRemovedHandler extends BaseHandler {
    constructor(private deps: TreeRemovedHandlerDeps, priority = 100) {
        super(priority, 'tree-removed-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        if (message.t !== MessageType.TreeRemoved) return;

        const connection = this.deps.agentConnectionRegistry.getByConnectionId(client.id);

        if (!connection) {
            this.logger.warn('TreeRemoved from unknown client', { connectionId: client.id, transport: client.transport });
            return;
        }

        const { clientId, sessionId } = connection;
        await this.deps.treeRepository.markRemoved(clientId, sessionId, message.treeId);
        await this.deps.eventDispatcher.dispatchAgentEvent({
            name: 'CatalogChanged',
            body: { clientId, sessionId },
        });

        this.logger.debug('Tree removed', { clientId, sessionId, treeId: message.treeId });
    }
}
