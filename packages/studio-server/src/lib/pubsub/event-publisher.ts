import { SubscriptionManagerInterface } from './subscription-manager';
import type { Logger } from '../logger';
import type { Connection, Server } from '../connection';

export interface EventPublisherInterface<TSend> {
    publishEvent(topic: string, message: TSend): Promise<void>;
    publishEventToClient(clientId: string, topic: string, message: TSend): Promise<void>;
}

export class EventPublisher<TConfig, TContext, TReceive, TSend, TConnection extends Connection<TReceive, TSend> = Connection<TReceive, TSend>> implements EventPublisherInterface<TSend> {
    private readonly server: Server<TConfig, TContext, TReceive, TSend, TConnection>;
    private readonly subscriptionManager: SubscriptionManagerInterface;
    private readonly logger: Logger;
    private readonly formatSubscribedEvent: (topic: string, message: TSend) => TSend;

    constructor(
        server: Server<TConfig, TContext, TReceive, TSend, TConnection>,
        subscriptionManager: SubscriptionManagerInterface,
        logger: Logger,
        formatSubscribedEvent: (topic: string, message: TSend) => TSend
    ) {
        this.server = server;
        this.subscriptionManager = subscriptionManager;
        this.logger = logger;
        this.formatSubscribedEvent = formatSubscribedEvent;
    }

    async publishEvent(topic: string, message: TSend): Promise<void> {
        const subscriberIds = this.subscriptionManager.getSubscribersForTopic(topic);

        if (subscriberIds.length === 0) {
            this.logger.debug('No subscribers for topic', { topic });
            return;
        }

        this.logger.debug('Publishing event to subscribers', {
            topic,
            subscriberCount: String(subscriberIds.length),
        });

        const eventMessage = this.formatSubscribedEvent(topic, message);

        for (const clientId of subscriberIds) {
            try {
                const client = this.server.getClient(clientId);
                if (client) {
                    this.server.sendToClient(clientId, eventMessage);
                } else {
                    this.logger.warn('Client not found for subscription', { clientId, topic });
                    this.subscriptionManager.unsubscribeAll(clientId);
                }
            } catch (error) {
                this.logger.error('Failed to send event to client', {
                    clientId,
                    topic,
                    error: String(error)
                });
            }
        }
    }

    async publishEventToClient(clientId: string, topic: string, message: TSend): Promise<void> {
        const client = this.server.getClient(clientId);
        if (!client) {
            this.logger.warn('Attempted to publish to unregistered client', { clientId, topic });
            return;
        }

        this.logger.debug('Publishing event to specific client', { clientId, topic });

        const eventMessage = this.formatSubscribedEvent(topic, message);

        try {
            this.server.sendToClient(clientId, eventMessage);
        } catch (error) {
            this.logger.error('Failed to send event to specific client', {
                clientId,
                topic,
                error: String(error)
            });
        }
    }
}
