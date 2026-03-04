export interface ConnectionSerializer<TReceive, TSend> {
    serialize(message: TSend): string | Uint8Array;
    deserialize(raw: string | Uint8Array): TReceive | undefined;
}

export interface Connection<TReceive, TSend> {
    readonly id: string;
    readonly transport: string;
    send(message: TSend): void;
    disconnect(): void;
    onMessage(handler: (message: TReceive) => void | Promise<void>): void;
    onDisconnect(handler: () => void): void;
    isConnected(): boolean;
}

export interface Server<TConfig, TContext, TReceive, TSend, TConnection extends Connection<TReceive, TSend> = Connection<TReceive, TSend>> {
    start(config: TConfig): Promise<void>;
    stop(): Promise<void>;
    broadcast(message: TSend): void;
    sendToClient(clientId: string, message: TSend): void;
    onConnection(handler: (client: TConnection, context: TContext) => void): void;
    onDisconnection(handler: (clientId: string) => void): void;
    getClient(clientId: string): TConnection | undefined;
    getClients(): Map<string, TConnection>;
    getClientCount(): number;
}
