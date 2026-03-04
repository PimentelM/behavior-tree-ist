import { CommandResponse, StudioCommand, MessageType, InboundMessage } from '@behavior-tree-ist/core';
import { CommandBrokerInterface, CommandSenderInterface } from '../interfaces';
import { createLogger } from '../../infra/logging';
import { AbstractCommandBroker } from '../../lib/command-broker';

export class CommandBroker extends AbstractCommandBroker<StudioCommand, CommandResponse, InboundMessage> implements CommandBrokerInterface {
    constructor(
        commandSender: CommandSenderInterface,
        timeoutMs: number
    ) {
        super(commandSender, timeoutMs, createLogger('command-broker'));
    }

    protected prepareMessage(command: StudioCommand): InboundMessage {
        return {
            t: MessageType.Command,
            command,
        };
    }
}
