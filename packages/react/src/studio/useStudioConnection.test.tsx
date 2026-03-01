import { StrictMode, useEffect } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { StudioConnectionModel } from './types';
import { useStudioConnection } from './useStudioConnection';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  static reset(): void {
    MockWebSocket.instances = [];
  }

  static last(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly sentFrames: unknown[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sentFrames.push(JSON.parse(payload));
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
}

function HookHarness({ serverUrl, onModel }: { serverUrl: string; onModel: (model: StudioConnectionModel) => void }) {
  const model = useStudioConnection({
    serverUrl,
    heartbeatMs: 60_000,
  });

  useEffect(() => {
    onModel(model);
  }, [model, onModel]);

  return null;
}

describe('useStudioConnection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    MockWebSocket.reset();
  });

  it('does not recreate websocket when selecting a tree', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);

    let latestModel: StudioConnectionModel | null = null;
    render(<HookHarness serverUrl="http://localhost:3210" onModel={(model) => { latestModel = model; }} />);

    expect(MockWebSocket.instances.length).toBe(1);
    const socket = MockWebSocket.last();
    expect(socket).toBeTruthy();

    await act(async () => {
      socket!.open();
    });

    expect(latestModel).toBeTruthy();
    await act(async () => {
      latestModel!.selectTree('heavy-profiler-demo');
    });

    expect(MockWebSocket.instances.length).toBe(1);
  });

  it('ignores close events from stale sockets', async () => {
    vi.stubGlobal('WebSocket', MockWebSocket);

    let latestModel: StudioConnectionModel | null = null;
    const { rerender } = render(
      <StrictMode>
        <HookHarness serverUrl="http://localhost:3210" onModel={(model) => { latestModel = model; }} />
      </StrictMode>,
    );

    expect(MockWebSocket.instances.length).toBe(2);
    const firstSocket = MockWebSocket.instances[0];
    const secondSocket = MockWebSocket.instances[1];

    await act(async () => {
      secondSocket.open();
    });

    rerender(
      <StrictMode>
        <HookHarness serverUrl="http://localhost:3211" onModel={(model) => { latestModel = model; }} />
      </StrictMode>,
    );

    const thirdSocket = MockWebSocket.last();
    expect(thirdSocket).toBeTruthy();
    expect(thirdSocket).not.toBe(secondSocket);

    await act(async () => {
      thirdSocket!.open();
    });

    await act(async () => {
      firstSocket.onclose?.(new CloseEvent('close'));
      secondSocket.onclose?.(new CloseEvent('close'));
    });

    expect(latestModel).toBeTruthy();
    expect(latestModel!.status).toBe('connected');

    await act(async () => {
      latestModel!.selectTree('heavy-profiler-demo');
    });

    const sent = thirdSocket!.sentFrames as Array<{ method?: string }>;
    expect(sent.some((frame) => frame.method === 'ui.selectTree')).toBe(true);
  });
});
