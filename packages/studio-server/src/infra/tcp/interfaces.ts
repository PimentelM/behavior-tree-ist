import type { MessageServerInterface } from '../../types/interfaces';

export interface RawTcpServerConfigInterface {
    host: string;
    port: number;
    maxConnections: number;
}

export interface RawTcpConnectionContext {
    transport: 'tcp';
    remoteAddress?: string;
    remotePort?: number;
}

export type RawTcpServerInterface =
    MessageServerInterface<RawTcpServerConfigInterface, RawTcpConnectionContext>;
