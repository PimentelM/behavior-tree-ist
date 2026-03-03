import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { BaseHandler } from './base-handler';
import { MessageConnectionInterface } from '../../../types/interfaces';
import { TreeRepositoryInterface, AgentConnectionRegistryInterface } from '../../../domain/interfaces';

interface TreeRegisteredHandlerDeps {
    treeRepository: TreeRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
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

        this.logger.debug('Tree registered', { clientId, sessionId, treeId: message.treeId });
    }
}
