import { topicMatches } from './topics';
import type { Logger } from '../logger';

export interface Subscription {
    clientId: string;
    topic: string;
    subscribedAt: Date;
}

export interface SubscriptionManagerInterface {
    subscribe(clientId: string, topic: string): boolean;
    unsubscribe(clientId: string, topic: string): boolean;
    unsubscribeAll(clientId: string): void;
    getSubscriptions(clientId: string): Subscription[];
    getSubscribersForTopic(topic: string): string[];
    getAllSubscriptions(): Map<string, Subscription[]>;
    hasSubscription(clientId: string, topic: string): boolean;
    getTopicPatterns(): string[];
}

export class SubscriptionManager implements SubscriptionManagerInterface {
    private subscriptions = new Map<string, Subscription[]>();
    private readonly logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    subscribe(clientId: string, topic: string): boolean {
        if (this.hasSubscription(clientId, topic)) {
            this.logger.debug('Client already subscribed to topic', { clientId, topic });
            return false;
        }

        const subscription: Subscription = {
            clientId,
            topic,
            subscribedAt: new Date()
        };

        if (!this.subscriptions.has(clientId)) {
            this.subscriptions.set(clientId, []);
        }

        this.subscriptions.get(clientId)!.push(subscription);

        this.logger.info('Client subscribed to topic', {
            clientId,
            topic,
            totalSubscriptions: String(this.subscriptions.get(clientId)!.length)
        });

        return true;
    }

    unsubscribe(clientId: string, topic: string): boolean {
        const clientSubscriptions = this.subscriptions.get(clientId);
        if (!clientSubscriptions) {
            return false;
        }

        const initialLength = clientSubscriptions.length;
        const filteredSubscriptions = clientSubscriptions.filter(sub => sub.topic !== topic);

        if (filteredSubscriptions.length === initialLength) {
            return false;
        }

        if (filteredSubscriptions.length === 0) {
            this.subscriptions.delete(clientId);
        } else {
            this.subscriptions.set(clientId, filteredSubscriptions);
        }

        this.logger.info('Client unsubscribed from topic', {
            clientId,
            topic,
            remainingSubscriptions: String(filteredSubscriptions.length)
        });

        return true;
    }

    unsubscribeAll(clientId: string): void {
        const clientSubscriptions = this.subscriptions.get(clientId);
        if (!clientSubscriptions) {
            return;
        }

        const subscriptionCount = clientSubscriptions.length;
        this.subscriptions.delete(clientId);

        this.logger.info('Client unsubscribed from all topics', {
            clientId,
            removedSubscriptions: String(subscriptionCount)
        });
    }

    getSubscriptions(clientId: string): Subscription[] {
        return this.subscriptions.get(clientId) || [];
    }

    getSubscribersForTopic(topic: string): string[] {
        const subscribers: string[] = [];

        for (const [clientId, clientSubscriptions] of this.subscriptions) {
            for (const subscription of clientSubscriptions) {
                if (this.topicMatches(subscription.topic, topic)) {
                    subscribers.push(clientId);
                    break; // Only add each client once
                }
            }
        }

        return subscribers;
    }

    getAllSubscriptions(): Map<string, Subscription[]> {
        return new Map(this.subscriptions);
    }

    hasSubscription(clientId: string, topic: string): boolean {
        const clientSubscriptions = this.subscriptions.get(clientId);
        if (!clientSubscriptions) {
            return false;
        }

        return clientSubscriptions.some(sub => sub.topic === topic);
    }

    getTopicPatterns(): string[] {
        const patterns = new Set<string>();

        for (const clientSubscriptions of this.subscriptions.values()) {
            for (const subscription of clientSubscriptions) {
                patterns.add(subscription.topic);
            }
        }

        return Array.from(patterns);
    }

    private topicMatches(pattern: string, topic: string): boolean {
        return topicMatches(pattern, topic);
    }
}
