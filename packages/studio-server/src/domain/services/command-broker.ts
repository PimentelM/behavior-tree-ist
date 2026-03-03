import { CommandResponse, StudioCommand, MessageType, InboundMessage } from '@behavior-tree-ist/core';
import { CommandBrokerInterface, CommandSenderInterface } from '../interfaces';
import { createLogger } from '../../infra/logging';

interface PendingCommand {
    resolve: (response: CommandResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export class CommandBroker implements CommandBrokerInterface {
    private pending = new Map<string, PendingCommand>();
    private logger = createLogger('command-broker');
    private isShuttingDown = false;

    constructor(
        private commandSender: CommandSenderInterface,
        private timeoutMs: number
    ) { }

    async sendCommand(connectionId: string, command: StudioCommand): Promise<CommandResponse> {
        if (this.isShuttingDown) {
            throw new Error('Command broker is shutting down');
        }

        const message: InboundMessage = {
            t: MessageType.Command,
            command,
        };

        return new Promise<CommandResponse>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(command.correlationId);
                reject(new Error(`Command ${command.correlationId} timed out after ${this.timeoutMs}ms`));
            }, this.timeoutMs);

            this.pending.set(command.correlationId, { resolve, reject, timer });
            this.commandSender.sendToClient(connectionId, message);

            this.logger.debug('Command sent', {
                correlationId: command.correlationId,
                connectionId,
                command: command.command,
            });
        });
    }

    handleResponse(correlationId: string, response: CommandResponse): void {
        const pending = this.pending.get(correlationId);
        if (!pending) {
            this.logger.warn('No pending command for correlation ID', { correlationId });
            return;
        }

        clearTimeout(pending.timer);
        this.pending.delete(correlationId);
        pending.resolve(response);

        this.logger.debug('Command response received', { correlationId });
    }

    shutdown(): void {
        this.isShuttingDown = true;

        for (const [correlationId, pending] of this.pending.entries()) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`Command ${correlationId} cancelled because server is shutting down`));
        }

        this.pending.clear();
    }
}
