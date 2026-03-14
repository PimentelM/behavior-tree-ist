import { type AgentEvent, type DispatchedEvent, type ServerEvent } from '../../domain/events';
import { BaseEventDispatcher } from '../../_lib/events/base-event-dispatcher';
import { type EventStoreInterface } from '../../_lib/events/interfaces';
import { type Logger } from '../../_lib/logger';

export class EventDispatcher extends BaseEventDispatcher<DispatchedEvent> {
    constructor(
        eventStore: EventStoreInterface<DispatchedEvent> | null,
        logger: Logger
    ) {
        super(eventStore, logger);
    }

    public dispatchAgentEvent(event: AgentEvent): Promise<void> {
        const dispatchedEvent: DispatchedEvent = {
            subject: 'Agent',
            event,
        };
        return this.dispatchEvent(dispatchedEvent);
    }

    public dispatchServerEvent(event: ServerEvent): Promise<void> {
        const dispatchedEvent: DispatchedEvent = {
            subject: 'Server',
            event,
        };
        return this.dispatchEvent(dispatchedEvent);
    }
}
