import { MessageType, OutboundMessage } from '@behavior-tree-ist/core';
import { MessageConnectionInterface, MessageRouterInterface } from '../../types/interfaces';
import { MessageRouter as GenericMessageRouter } from '../../_lib/router';
import { createLogger } from '../logging';

export class MessageRouter extends GenericMessageRouter<MessageType, OutboundMessage, MessageConnectionInterface> implements MessageRouterInterface {
    constructor() {
        super(createLogger('message-router'));
    }
}
