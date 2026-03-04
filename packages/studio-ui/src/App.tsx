import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import type { SerializableNode } from '@behavior-tree-ist/core';
import { useStudioControls } from './use-studio-controls';

const PLACEHOLDER_TREE: SerializableNode = {
    id: 0,
    nodeFlags: 0,
    defaultName: 'No tree selected',
    name: 'No tree selected',
};

function App() {
    const { studioControls, tree, ticks } = useStudioControls();

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <main style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                <BehaviourTreeDebugger
                    tree={tree ?? PLACEHOLDER_TREE}
                    ticks={ticks}
                    isolateStyles={true}
                    inspectorOptions={{
                        maxTicks: studioControls.uiSettings.ringBufferSize,
                    }}
                    studioControls={studioControls}
                />
            </main>
        </div>
    );
}

export default App;
