import { type Logger } from '../logger';
import { type BaseDispatchedEvent, type EventStoreInterface } from './interfaces';

export abstract class BaseEventDispatcher<DispatchedEvent extends BaseDispatchedEvent> {
    constructor(
        public eventStore: EventStoreInterface<DispatchedEvent> | null,
        protected readonly logger: Logger
    ) { }

    public dispatchEvent(dispatchedEvent: DispatchedEvent): Promise<void> {
        if (this.eventStore) {
            this.eventStore.pushEvent(dispatchedEvent);
        }

        return this.executeDomainHandlers(dispatchedEvent);
    }

    public on<Subject extends DispatchedEvent['subject'], EventName extends DispatchedEvent['event']['name']>(
        subject: Subject,
        eventName: EventName,
        handler: (dispatchedEvent: DispatchedEvent & { subject: Subject; event: { name: EventName } }) => Promise<void>,
    ): () => void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const subjectEventHandlersMap: Map<DispatchedEvent['event']['name'], ((event: DispatchedEvent) => Promise<void>)[]> =
            this.domainEventHandlers.get(subject) ?? new Map();
        const eventHandlers: ((event: DispatchedEvent) => Promise<void>)[] =
            subjectEventHandlersMap.get(eventName) ?? [];

        eventHandlers.push(handler as ((event: DispatchedEvent) => Promise<void>));

        subjectEventHandlersMap.set(eventName, eventHandlers);
        this.domainEventHandlers.set(subject, subjectEventHandlersMap);

        // Return an "off" function that removes this specific handler
        return () => {
            const currentSubjectMap = this.domainEventHandlers.get(subject);
            if (!currentSubjectMap) return;

            const currentHandlers = currentSubjectMap.get(eventName);
            if (!currentHandlers) return;

            const handlerIndex = currentHandlers.indexOf(handler as ((event: DispatchedEvent) => Promise<void>));
            if (handlerIndex > -1) {
                currentHandlers.splice(handlerIndex, 1);

                // Clean up empty arrays and maps
                if (currentHandlers.length === 0) {
                    currentSubjectMap.delete(eventName);
                    if (currentSubjectMap.size === 0) {
                        this.domainEventHandlers.delete(subject);
                    }
                }
            }
        };
    }

    private logError(error: Error, { subject, event }: DispatchedEvent): void {
        this.logger.error(`Error while running handler for event ${subject}/${event.name}`, { error: String(error) });
    }

    private domainEventHandlers: Map<
        DispatchedEvent['subject'],
        Map<DispatchedEvent['event']['name'], ((event: DispatchedEvent) => Promise<void>)[]>
    > = new Map();

    private async executeDomainHandlers(event: DispatchedEvent): Promise<void> {
        const handlers = this.domainEventHandlers.get(event.subject)?.get(event.event.name);

        if (!handlers) {
            return;
        }

        for (const handler of handlers) {
            await handler(event).catch((error: unknown) => { this.logError(error instanceof Error ? error : new Error(String(error)), event); });
        }
    }
}
