// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = () => {};

// Node 22+ ships a partial Web Storage stub that lacks removeItem/getItem/setItem.
// Override with a full in-memory implementation so tests can use localStorage normally.
if (typeof localStorage === 'undefined' || typeof localStorage.removeItem !== 'function') {
  const _store: Record<string, string> = {};
  const localStorageMock: Storage = {
    getItem: (key: string) => _store[key] ?? null,
    setItem: (key: string, value: string) => { _store[key] = String(value); },
    removeItem: (key: string) => { delete _store[key]; },
    clear: () => { for (const k of Object.keys(_store)) delete _store[k]; },
    key: (index: number) => Object.keys(_store)[index] ?? null,
    get length() { return Object.keys(_store).length; },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}
