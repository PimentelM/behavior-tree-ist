import type { WebSocketClientInterface } from '../../types/interfaces';

export interface RawTcpServerConfigInterface {
    host: string;
    port: number;
    maxConnections: number;
}

export interface RawTcpServerInterface {
    start(config: RawTcpServerConfigInterface): Promise<void>;
    stop(): Promise<void>;
    broadcast(message: object): void;
    sendToClient(clientId: string, message: object): void;
    onConnection(handler: (client: WebSocketClientInterface) => void): void;
    onDisconnection(handler: (clientId: string) => void): void;
    getClient(clientId: string): WebSocketClientInterface | undefined;
    getClients(): Map<string, WebSocketClientInterface>;
    getClientCount(): number;
}
