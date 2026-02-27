import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import { BehaviourTree, Sequence, Action, TickRecord, NodeResult, Selector, ref, Parallel } from '@behavior-tree-ist/core';
import { action, alwaysRunning, condition, parallel } from '@behavior-tree-ist/core/builder';
import { useEffect, useState, useCallback, useMemo } from 'react';

// Sample tree for verification
const createSampleTree = () => {

    const randomChance = (chance: number = 0.5) => Math.random() < chance

    const attackedCount = ref(0, "attacked-count");

    return new BehaviourTree(
        parallel({
            name: "Autopilot",
            policy: () => NodeResult.Succeeded,
            onTicked() {
                console.log(`Ticked!`)
            }
        },
            [
                Selector.from('Movment', [
                    Action.from('Flee Away', () => randomChance(0.1) ? NodeResult.Succeeded : NodeResult.Failed),
                    Action.from('Kite Monster', () => randomChance(0.2) ? NodeResult.Succeeded : NodeResult.Failed),
                    Action.from('Reach Monster', () => randomChance(0.5) ? NodeResult.Succeeded : NodeResult.Failed),
                    Action.from('Patrol', () => randomChance(0.9) ? NodeResult.Succeeded : NodeResult.Failed),
                ]),
                Sequence.from('Combat', [
                    condition({ name: "Has Target", eval: () => randomChance(0.4) }),
                    action({
                        name: 'Attack',
                        throttle: 600,
                        execute: () => randomChance(0.8) ? ((attackedCount.value++), NodeResult.Succeeded) : NodeResult.Failed
                    }),
                    action({
                        name: 'Gaze opponent',
                        execute() {
                            return NodeResult.Running;
                        }
                    })
                ]),
                alwaysRunning()
            ]
        )
    ).enableTrace();
};

function App() {
    const [tree] = useState(() => createSampleTree());
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const serializedTree = useMemo(() => tree.serialize(), [tree]);

    const handleTick = useCallback(() => {
        const tickRecord = tree.tick({});
        setTicks((prev) => [...prev, tickRecord]);
    }, [tree]);

    useEffect(() => {
        const interval = setInterval(handleTick, 20);
        return () => clearInterval(interval);
    }, [handleTick]);

    return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <header style={{ padding: '0 20px', background: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
                <h1>Behavior Tree Studio</h1>
            </header>
            <main style={{ flex: 1, position: 'relative' }}>
                <BehaviourTreeDebugger
                    tree={serializedTree}
                    ticks={ticks}
                    isolateStyles={true}
                    inspectorOptions={{
                        maxTicks: (1000 / 20) * 5
                    }} />
            </main>
        </div>
    );
}

export default App;
