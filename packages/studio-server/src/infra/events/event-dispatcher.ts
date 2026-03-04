import { AgentEvent, DispatchedEvent, ServerEvent } from '../../domain/events';
import { BaseEventDispatcher } from '../../lib/events/base-event-dispatcher';
import { EventStoreInterface } from '../../lib/events/interfaces';
import { Logger } from '../../lib/logger';

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
