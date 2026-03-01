import { WebSocket, WebSocketServer } from 'ws';
import type { RawData } from 'ws';
import type { OffFunction } from '@behavior-tree-ist/core';
import type { BinaryDuplexTransport } from '@behavior-tree-ist/core/studio';

function toTransportPayload(data: RawData): Uint8Array | string {
  if (typeof data === 'string') {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (Array.isArray(data)) {
    const chunks = data.map((chunk) => new Uint8Array(chunk));
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export class NodeWebSocketTransport implements BinaryDuplexTransport {
  constructor(private readonly socket: WebSocket) {}

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  send(data: Uint8Array | string): void {
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  onMessage(handler: (data: Uint8Array | string) => void): OffFunction {
    const listener = (data: RawData) => {
      handler(toTransportPayload(data));
    };
    this.socket.on('message', listener);
    return () => {
      this.socket.off('message', listener);
    };
  }

  onClose(handler: (reason?: string) => void): OffFunction {
    const listener = (_code: number, reason: unknown) => {
      if (typeof reason === 'string') {
        handler(reason);
        return;
      }
      if (reason instanceof Uint8Array) {
        handler(new TextDecoder().decode(reason));
        return;
      }
      handler(undefined);
    };
    this.socket.on('close', listener);
    return () => {
      this.socket.off('close', listener);
    };
  }

  onError(handler: (error: Error) => void): OffFunction {
    const listener = (error: Error) => {
      handler(error);
    };
    this.socket.on('error', listener);
    return () => {
      this.socket.off('error', listener);
    };
  }
}

export interface NodeWsServerOptions {
  host?: string;
  port: number;
  path?: string;
}

export class NodeWebSocketTransportServer {
  private readonly connectionHandlers = new Set<(transport: BinaryDuplexTransport) => void>();
  private wss: WebSocketServer | null = null;

  constructor(private readonly options: NodeWsServerOptions) {}

  public onConnection(handler: (transport: BinaryDuplexTransport) => void): OffFunction {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  public listen(): Promise<void> {
    if (this.wss) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({
        host: this.options.host,
        port: this.options.port,
        path: this.options.path,
      });

      wss.on('connection', (socket: unknown) => {
        if (!(socket instanceof WebSocket)) {
          return;
        }
        const transport = new NodeWebSocketTransport(socket);
        for (const handler of this.connectionHandlers) {
          handler(transport);
        }
      });

      wss.once('listening', () => {
        this.wss = wss;
        resolve();
      });

      wss.once('error', (error: unknown) => {
        reject(error);
      });
    });
  }

  public close(): Promise<void> {
    if (!this.wss) {
      return Promise.resolve();
    }

    const wss = this.wss;
    this.wss = null;
    return new Promise((resolve, reject) => {
      wss.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

export function connectNodeWebSocket(url: string): Promise<NodeWebSocketTransport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    socket.once('open', () => {
      resolve(new NodeWebSocketTransport(socket));
    });

    socket.once('error', (error: unknown) => {
      reject(error);
    });
  });
}
