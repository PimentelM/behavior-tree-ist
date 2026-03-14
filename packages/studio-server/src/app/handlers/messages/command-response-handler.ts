import { MessageType, type OutboundMessage } from '@bt-studio/core';
import { BaseHandler } from './base-handler';
import { type MessageConnectionInterface } from '../../../types/interfaces';
import { type CommandBrokerInterface } from '../../interfaces';

interface CommandResponseHandlerDeps {
    commandBroker: CommandBrokerInterface;
}

export class CommandResponseHandler extends BaseHandler {
    constructor(private deps: CommandResponseHandlerDeps, priority = 100) {
        super(priority, 'command-response-handler');
    }

    protected async handleMessage(message: OutboundMessage, _client: MessageConnectionInterface): Promise<void> {
        if (message.t !== MessageType.CommandResponse) return;

        this.deps.commandBroker.handleResponse(message.correlationId, message.response);
    }
}
