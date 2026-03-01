/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'ws' {
  export type RawData = string | ArrayBuffer | Uint8Array | Uint8Array[];
  export class WebSocket {
    static OPEN: number;
    readyState: number;
    constructor(url: string);
    send(data: unknown, cb?: (error?: Error) => void): void;
    close(code?: number, reason?: string): void;
    on(event: string, handler: (...args: any[]) => void): void;
    once(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
  }

  export class WebSocketServer {
    constructor(options: { host?: string; port?: number; path?: string; noServer?: boolean });
    on(event: string, handler: (...args: any[]) => void): void;
    once(event: string, handler: (...args: any[]) => void): void;
    close(cb?: (error?: Error) => void): void;
    handleUpgrade(
      request: unknown,
      socket: unknown,
      head: unknown,
      callback: (socket: WebSocket) => void,
    ): void;
  }
}
