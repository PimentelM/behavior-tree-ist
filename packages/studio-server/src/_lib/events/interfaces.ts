export type BaseDispatchedEvent = {
    subject: string;
    event: { name: string; body: unknown };
};

export interface EventStoreInterface<DispatchedEvent extends BaseDispatchedEvent> {
    getOperationId(): string;
    clearEvents(): void;
    getEvents(): DispatchedEvent[];
    pushEvent(event: DispatchedEvent): void;
}
