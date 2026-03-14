import { type CommandResponse, type StudioCommand, MessageType, type InboundMessage } from '@bt-studio/core';
import { type CommandBrokerInterface, type CommandSenderInterface } from '../interfaces';
import { createLogger } from '../../infra/logging';
import { AbstractCommandBroker } from '../../_lib/command-broker';

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
