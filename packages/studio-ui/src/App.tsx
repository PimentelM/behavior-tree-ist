import { BehaviourTreeDebugger } from '@bt-studio/react';
import type { SerializableNode } from '@bt-studio/core';
import { useStudioControls } from './use-studio-controls';
import { ReplTerminal } from './repl';

const PLACEHOLDER_TREE: SerializableNode = {
    id: 0,
    nodeFlags: 0,
    defaultName: 'No tree selected',
    name: 'No tree selected',
};

const emptyPanels = {
    nodeDetails: false as const,
    timeline: false as const,
    refTraces: false as const,
    activityNow: false as const,
    performance: false as const,
};

const onboardingContent = (
    <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px', color: 'var(--bt-text-secondary)' }}>
            No tree connected
        </p>
        <p style={{ fontSize: 13, margin: 0, color: 'var(--bt-text-muted)' }}>
            Click <strong>Attach</strong> to connect to a running agent
        </p>
    </div>
);

function App() {
    const { studioControls, tree, ticks } = useStudioControls();
    const isEmpty = tree === null;

    const clientId = studioControls.selection?.clientId ?? null;
    const sessionId = studioControls.selection?.sessionId ?? null;

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                <BehaviourTreeDebugger
                    tree={tree ?? PLACEHOLDER_TREE}
                    ticks={ticks}
                    isolateStyles={true}
                    inspectorOptions={{
                        maxTicks: studioControls.windowMaxTicks ?? studioControls.uiSettings.ringBufferSize,
                    }}
                    studioControls={studioControls}
                    panels={isEmpty ? emptyPanels : undefined}
                    emptyState={isEmpty ? onboardingContent : undefined}
                    replPanel={<ReplTerminal clientId={clientId} sessionId={sessionId} />}
                />
            </main>
        </div>
    );
}

export default App;
