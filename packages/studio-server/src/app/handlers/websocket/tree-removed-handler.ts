import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { BaseHandler } from './base-handler';
import { WebSocketClientInterface } from '../../../types/interfaces';
import { TreeRepositoryInterface, AgentConnectionRegistryInterface } from '../../../domain/interfaces';

interface TreeRemovedHandlerDeps {
    treeRepository: TreeRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
}

export class TreeRemovedHandler extends BaseHandler {
    constructor(private deps: TreeRemovedHandlerDeps, priority = 100) {
        super(priority, 'tree-removed-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: WebSocketClientInterface): Promise<void> {
        if (message.t !== MessageType.TreeRemoved) return;

        const connection = this.deps.agentConnectionRegistry.getAllConnections()
            .find(c => c.wsClientId === client.id);

        if (!connection) {
            this.logger.warn('TreeRemoved from unknown client', { wsClientId: client.id });
            return;
        }

        const { clientId, sessionId } = connection;
        await this.deps.treeRepository.markRemoved(clientId, sessionId, message.treeId);

        this.logger.debug('Tree removed', { clientId, sessionId, treeId: message.treeId });
    }
}
