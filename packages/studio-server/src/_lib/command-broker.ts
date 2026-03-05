import type { Logger } from './logger';

export interface CommandSender<TOutbound> {
    sendToClient(clientId: string, message: TOutbound): void;
}

export interface CorrelationIdentifiable {
    correlationId: string;
}

export interface PendingCommand<TResponse> {
    resolve: (response: TResponse) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}

export abstract class AbstractCommandBroker<TCommand extends CorrelationIdentifiable, TResponse, TOutbound> {
    private pending = new Map<string, PendingCommand<TResponse>>();
    private isShuttingDown = false;
    protected readonly logger: Logger;

    constructor(
        protected readonly commandSender: CommandSender<TOutbound>,
        protected readonly timeoutMs: number,
        logger: Logger
    ) {
        this.logger = logger;
    }

    protected abstract prepareMessage(command: TCommand): TOutbound;

    async sendCommand(connectionId: string, command: TCommand): Promise<TResponse> {
        if (this.isShuttingDown) {
            throw new Error('Command broker is shutting down');
        }

        const message = this.prepareMessage(command);

        return new Promise<TResponse>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(command.correlationId);
                reject(new Error(`Command ${command.correlationId} timed out after ${this.timeoutMs}ms`));
            }, this.timeoutMs);

            this.pending.set(command.correlationId, { resolve, reject, timer });
            this.commandSender.sendToClient(connectionId, message);

            this.logger.debug('Command sent', {
                correlationId: command.correlationId,
                connectionId,
            });
        });
    }

    handleResponse(correlationId: string, response: TResponse): void {
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
