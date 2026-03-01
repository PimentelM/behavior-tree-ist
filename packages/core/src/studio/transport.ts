import type { OffFunction } from "../base/types";

export interface BinaryDuplexTransport {
    readonly isOpen: boolean;
    send(data: Uint8Array | string): void;
    close(code?: number, reason?: string): void;
    onMessage(handler: (data: Uint8Array | string) => void): OffFunction;
    onClose(handler: (reason?: string) => void): OffFunction;
    onError(handler: (error: Error) => void): OffFunction;
}

export type TransportDialer = () => Promise<BinaryDuplexTransport>;
