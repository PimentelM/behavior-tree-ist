import { Logger } from "../logger";
import { BaseEventDispatcher } from "./base-event-dispatcher";
import { EventDispatcherExample } from "./example-event-map";
import { EventStoreInterface } from "./interfaces";

export class ExampleEventDispatcher extends BaseEventDispatcher<EventDispatcherExample.DispatchedEvent> {
    constructor(
        eventStore: EventStoreInterface<EventDispatcherExample.DispatchedEvent>,
        logger: Logger
    ) {
        super(eventStore, logger);
    }


    public dispatchPlayerEvent(event: EventDispatcherExample.PlayerEvent): void {
        const dispatchedEvent: EventDispatcherExample.DispatchedEvent = {
            subject: 'player',
            event,
        };
        this.dispatchEvent(dispatchedEvent);
    }

    public dispatchArenaEvent(event: EventDispatcherExample.ArenaEvent): void {
        const dispatchedEvent: EventDispatcherExample.DispatchedEvent = {
            subject: 'arena',
            event,
        };
        this.dispatchEvent(dispatchedEvent);
    }
}