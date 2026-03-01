export type Unsubscribe = () => void;

export interface Transport {
    send(data: string): void;
    onMessage(handler: (data: string) => void): Unsubscribe;
    onOpen(handler: () => void): Unsubscribe;
    onClose(handler: () => void): Unsubscribe;
    close(): void;
    readonly isConnected: boolean;
}
