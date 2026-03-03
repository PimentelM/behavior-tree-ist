import { OutboundMessage } from '@behavior-tree-ist/core';
import { MessageHandler, WebSocketClientInterface } from '../../../types/interfaces';
import { Logger, createLogger } from '../../../infra/logging';

export abstract class BaseHandler implements MessageHandler {
    protected readonly logger: Logger;

    constructor(
        public readonly priority: number = 100,
        loggerName: string
    ) {
        this.logger = createLogger(loggerName);
    }

    async handle(message: OutboundMessage, client: WebSocketClientInterface): Promise<void> {
        try {
            await this.handleMessage(message, client);
        } catch (error) {
            this.handleError(error, message, client);
        }
    }

    protected abstract handleMessage(message: OutboundMessage, client: WebSocketClientInterface): Promise<void>;

    protected handleError(error: unknown, message: OutboundMessage, client: WebSocketClientInterface): void {
        this.logger.error(`Error handling message type ${message.t} from client ${client.id}`, {
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
