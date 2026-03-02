export type Unsubscribe = () => void;

export interface Transport {
    send(data: string | ArrayBuffer): void;
    onMessage(handler: (data: string | ArrayBuffer) => void): Unsubscribe;
    onOpen(handler: () => void): Unsubscribe;
    onClose(handler: () => void): Unsubscribe;
    close(): void;
    readonly isConnected: boolean;
}
