import { useState } from 'react';
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

const REPL_HEIGHT = 280;

function App() {
    const { studioControls, tree, ticks } = useStudioControls();
    const [replVisible, setReplVisible] = useState(false);
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
                />
                <button
                    onClick={() => setReplVisible((v) => !v)}
                    title="Toggle REPL"
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        zIndex: 100,
                        background: replVisible ? '#300a24' : '#1a0012',
                        border: '1px solid #4a1942',
                        color: replVisible ? '#8ae234' : '#ad7fa8',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '3px 10px',
                        fontFamily: 'Ubuntu Mono, monospace',
                    }}
                >
                    {replVisible ? '▼ REPL' : '▲ REPL'}
                </button>
            </main>
            {replVisible && (
                <aside style={{ height: REPL_HEIGHT, borderTop: '1px solid #4a1942', flexShrink: 0 }}>
                    <ReplTerminal clientId={clientId} sessionId={sessionId} height={REPL_HEIGHT - 28} />
                </aside>
            )}
        </div>
    );
}

export default App;
