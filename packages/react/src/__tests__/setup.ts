// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// react-flow uses ResizeObserver to track canvas bounds
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverMock {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  (globalThis as unknown as { ResizeObserver?: { new (...args: unknown[]): unknown } }).ResizeObserver =
    ResizeObserverMock as unknown as { new (...args: unknown[]): unknown };
}
