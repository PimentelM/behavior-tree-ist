import { type MessageType, type OutboundMessage } from '@bt-studio/core';
import { type MessageConnectionInterface, type MessageRouterInterface } from '../../types/interfaces';
import { MessageRouter as GenericMessageRouter } from '../../_lib/router';
import { createLogger } from '../logging';

export class MessageRouter extends GenericMessageRouter<MessageType, OutboundMessage, MessageConnectionInterface> implements MessageRouterInterface {
    constructor() {
        super(createLogger('message-router'));
    }
}
