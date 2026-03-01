import type { OffFunction } from '@behavior-tree-ist/core';
import type { BinaryDuplexTransport } from '@behavior-tree-ist/core/studio';

function toUint8Array(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data);
}

export class BrowserWebSocketTransport implements BinaryDuplexTransport {
  constructor(private readonly socket: WebSocket) {}

  get isOpen(): boolean {
    return this.socket.readyState === WebSocket.OPEN;
  }

  send(data: Uint8Array | string): void {
    if (typeof data === 'string') {
      this.socket.send(data);
      return;
    }
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  onMessage(handler: (data: Uint8Array | string) => void): OffFunction {
    const listener = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        handler(event.data);
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        handler(toUint8Array(event.data));
        return;
      }

      if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buffer) => {
          handler(toUint8Array(buffer));
        });
      }
    };

    this.socket.addEventListener('message', listener);
    return () => {
      this.socket.removeEventListener('message', listener);
    };
  }

  onClose(handler: (reason?: string) => void): OffFunction {
    const listener = (event: CloseEvent) => {
      handler(event.reason);
    };
    this.socket.addEventListener('close', listener);
    return () => {
      this.socket.removeEventListener('close', listener);
    };
  }

  onError(handler: (error: Error) => void): OffFunction {
    const listener = () => {
      handler(new Error('Browser WebSocket error'));
    };
    this.socket.addEventListener('error', listener);
    return () => {
      this.socket.removeEventListener('error', listener);
    };
  }
}

export function connectBrowserWebSocket(url: string, protocols?: string | string[]): Promise<BrowserWebSocketTransport> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, protocols);
    socket.binaryType = 'arraybuffer';

    socket.addEventListener('open', () => {
      resolve(new BrowserWebSocketTransport(socket));
    }, { once: true });

    socket.addEventListener('error', () => {
      reject(new Error(`Failed to connect to ${url}`));
    }, { once: true });
  });
}
