import { StudioDebugger } from '@behavior-tree-ist/react';

function App() {
  const serverUrl = import.meta.env.VITE_STUDIO_SERVER_URL ?? window.location.origin;

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <StudioDebugger
        serverUrl={serverUrl}
        debuggerProps={{
          showToolbar: true,
        }}
      />
    </div>
  );
}

export default App;
