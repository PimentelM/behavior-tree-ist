import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { BaseHandler } from './base-handler';
import { MessageConnectionInterface } from '../../../types/interfaces';
import { ClientRepositoryInterface, SessionRepositoryInterface } from '../../../domain/interfaces';
import { AgentConnectionRegistryInterface } from '../../interfaces';

interface HelloHandlerDeps {
    clientRepository: ClientRepositoryInterface;
    sessionRepository: SessionRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
}

export class HelloHandler extends BaseHandler {
    constructor(private deps: HelloHandlerDeps, priority = 100) {
        super(priority, 'hello-handler');
    }

    protected async handleMessage(message: OutboundMessage, client: MessageConnectionInterface): Promise<void> {
        if (message.t !== MessageType.Hello) return;

        const { clientId, sessionId } = message;

        await this.deps.clientRepository.upsert(clientId);
        await this.deps.sessionRepository.upsert(clientId, sessionId);
        this.deps.agentConnectionRegistry.register(client.id, clientId, sessionId);

        this.logger.info('Agent connected', { clientId, sessionId, connectionId: client.id, transport: client.transport });
    }
}
