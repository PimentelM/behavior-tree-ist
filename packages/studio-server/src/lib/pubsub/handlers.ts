import type { MessageHandler } from '../router';
import type { Logger } from '../logger';
import { SubscriptionManagerInterface } from './subscription-manager';
import type { Connection } from '../connection';

export interface SubscriptionHandlerDependencies<TMessage, TSend> {
    subscriptionManager: SubscriptionManagerInterface;
    logger: Logger;
    priority?: number;
    extractTopic: (message: TMessage) => string;
    formatResponse: (topic: string, success: boolean, action: 'subscribe' | 'unsubscribe', message: string) => TSend;
}

export class SubscribeHandler<TMessage, TReceive, TSend, TConnection extends Connection<TReceive, TSend>> implements MessageHandler<TMessage, TConnection> {
    public readonly priority: number;
    private readonly subscriptionManager: SubscriptionManagerInterface;
    private readonly logger: Logger;
    private readonly extractTopic: (message: TMessage) => string;
    private readonly formatResponse: (topic: string, success: boolean, action: 'subscribe' | 'unsubscribe', message: string) => TSend;

    constructor(
        dependencies: SubscriptionHandlerDependencies<TMessage, TSend>
    ) {
        this.priority = dependencies.priority ?? 50;
        this.subscriptionManager = dependencies.subscriptionManager;
        this.logger = dependencies.logger;
        this.extractTopic = dependencies.extractTopic;
        this.formatResponse = dependencies.formatResponse;
    }

    async handle(message: TMessage, client: TConnection): Promise<void> {
        const topic = this.extractTopic(message);

        this.logger.info('Processing subscription request', {
            clientId: client.id,
            topic
        });

        const success = this.subscriptionManager.subscribe(client.id, topic);
        const responseMessage = success ? 'Successfully subscribed' : 'Already subscribed to this topic';

        const response = this.formatResponse(topic, success, 'subscribe', responseMessage);
        client.send(response);
    }
}

export class UnsubscribeHandler<TMessage, TReceive, TSend, TConnection extends Connection<TReceive, TSend>> implements MessageHandler<TMessage, TConnection> {
    public readonly priority: number;
    private readonly subscriptionManager: SubscriptionManagerInterface;
    private readonly logger: Logger;
    private readonly extractTopic: (message: TMessage) => string;
    private readonly formatResponse: (topic: string, success: boolean, action: 'subscribe' | 'unsubscribe', message: string) => TSend;

    constructor(
        dependencies: SubscriptionHandlerDependencies<TMessage, TSend>
    ) {
        this.priority = dependencies.priority ?? 50;
        this.subscriptionManager = dependencies.subscriptionManager;
        this.logger = dependencies.logger;
        this.extractTopic = dependencies.extractTopic;
        this.formatResponse = dependencies.formatResponse;
    }

    async handle(message: TMessage, client: TConnection): Promise<void> {
        const topic = this.extractTopic(message);

        this.logger.info('Processing unsubscription request', {
            clientId: client.id,
            topic
        });

        const success = this.subscriptionManager.unsubscribe(client.id, topic);
        const responseMessage = success ? 'Successfully unsubscribed' : 'Was not subscribed to this topic';

        const response = this.formatResponse(topic, success, 'unsubscribe', responseMessage);
        client.send(response);
    }
}
