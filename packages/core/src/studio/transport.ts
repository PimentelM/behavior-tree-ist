import { OffFunction } from "../types";

export type TransportData = string | Uint8Array;

export interface TransportInterface {
    open(): Promise<void>;
    close(): void;
    send(data: TransportData): void;
    onMessage(handler: (data: TransportData) => void): OffFunction;
    onError(handler: (error: Error) => void): OffFunction;
    onClose(handler: () => void): OffFunction;
}

export type TransportFactory = () => TransportInterface;
