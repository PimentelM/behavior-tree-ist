import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type ClientRepositoryInterface, type SessionRepositoryInterface } from '../../../domain/interfaces';
import { type AgentConnectionRegistryInterface, type DomainEventDispatcherInterface } from '../../interfaces';

interface HelloHandlerDeps {
    clientRepository: ClientRepositoryInterface;
    sessionRepository: SessionRepositoryInterface;
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    eventDispatcher: DomainEventDispatcherInterface;
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
        await this.deps.eventDispatcher.dispatchAgentEvent({
            name: 'AgentConnected',
            body: { clientId, sessionId },
        });

        this.logger.info('Agent connected', { clientId, sessionId, connectionId: client.id, transport: client.transport });
    }
}
