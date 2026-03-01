import { StudioDebugger } from '@behavior-tree-ist/react';

function inferStudioServerUrl(): string {
  const configured = import.meta.env.VITE_STUDIO_SERVER_URL as string | undefined;
  if (configured && configured.trim().length > 0) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://127.0.0.1:3210';
}

function App() {
  const serverUrl = inferStudioServerUrl();

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
