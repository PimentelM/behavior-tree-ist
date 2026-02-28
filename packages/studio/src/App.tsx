import { BehaviourTreeDebugger } from '@behavior-tree-ist/react';
import { BehaviourTree, TickRecord, NodeResult, ref, Tag } from '@behavior-tree-ist/core';
import {
    action,
    asyncAction,
    condition,
    parallel,
    sequence,
    selector,
    ifThenElse,
    sequenceWithMemory,
    selectorWithMemory,
    utilityFallback,
    utilitySequence,
    utility,
    alwaysRunning,
    alwaysSuccess,
    alwaysFailure,
    sleep,
    displayState
} from '@behavior-tree-ist/core/builder';
import { useEffect, useState, useCallback, useMemo } from 'react';

// Sample tree for verification
const createSampleTree = () => {
    const randomChance = (chance: number = 0.5) => Math.random() < chance;

    const hp = ref(100, "hp");
    const mana = ref(50, "mana");
    const enemyHp = ref(100, "enemy-hp");
    const energy = ref(0, "energy");
    const hunger = ref(0, "hunger");
    const thirst = ref(0, "thirst");

    return new BehaviourTree(
        parallel({
            name: "Comprehensive Root",
            policy: () => NodeResult.Succeeded,
            onTicked: (res) => console.log(`Root Ticked: ${res}`)
        }, [
            // 1. Basic Movement & Resource Management (Sequence with Decorators)
            sequence({
                name: "Vital Signs",
                throttle: 1000,
                onEnter: () => console.log("Checking vitals...")
            }, [
                condition({ name: "Internal Clock", eval: () => randomChance(0.9) }),
                action({
                    name: "Metabolism",
                    execute: () => {
                        hunger.value += 1;
                        thirst.value += 1;
                        return NodeResult.Succeeded;
                    }
                }),
                displayState({
                    name: "Vitals Monitor",
                    display: () => ({ hp: hp.value, hunger: hunger.value, thirst: thirst.value }),
                    tags: ["ui", "debug"],
                    onRunning: () => console.log("Vitals monitor is active..."),
                    inputs: [hp, hunger, thirst],
                    outputs: [hp]
                })
            ]),

            // 2. Combat System (Selector & SequenceWithMemory)
            selector({
                name: "Combat AI",
                precondition: { name: "Has Enemy", condition: () => randomChance(0.6) },
                onFailure: () => console.log("No enemies found.")
            }, [
                sequenceWithMemory({
                    name: "Charged Attack",
                    cooldown: 5000
                }, [
                    condition({ name: "Enough Energy", eval: () => energy.value >= 100 }),
                    asyncAction({
                        name: "Charging...",
                        execute: async (ctx, signal) => {
                            for (let i = 0; i < 5; i++) {
                                if (signal.aborted) return NodeResult.Failed;
                                energy.value -= 20;
                                await new Promise(r => setTimeout(r, 100));
                            }
                            return NodeResult.Succeeded;
                        }
                    }),
                    action({
                        name: "Unleash Blast",
                        execute: () => {
                            enemyHp.value -= 50;
                            return NodeResult.Succeeded;
                        }
                    })
                ]),
                sequence({
                    name: "Basic Strike",
                    retry: 2,
                    timeout: 2000
                }, [
                    condition({ name: "Check Mana", eval: () => mana.value > 10 }),
                    action({
                        name: "Slam",
                        execute: () => {
                            mana.value -= 5;
                            enemyHp.value -= 10;
                            return randomChance(0.7) ? NodeResult.Succeeded : NodeResult.Failed;
                        },
                        onSuccess: () => console.log("Hit!")
                    })
                ])
            ]),

            // 3. Decision Making (IfThenElse)
            ifThenElse({ name: "Survival Instinct" }, [
                condition({ name: "Critical HP?", eval: () => hp.value < 20 }),
                action({ name: "Panic Heal", execute: () => { hp.value += 30; return NodeResult.Succeeded; } }),
                action({ name: "Keep Fighting", execute: () => NodeResult.Succeeded })
            ]),

            // 4. Mission Progress (SelectorWithMemory & Control Decorators)
            selectorWithMemory({ name: "Quest Navigator" }, [
                sequence({
                    name: "Phase Alpha",
                    runOnce: true,
                    decorate: [
                        [Tag, "important"]
                    ]
                }, [
                    action({ name: "Locate Artifact", execute: () => randomChance(0.3) ? NodeResult.Succeeded : NodeResult.Running }),
                    sleep({ name: "Analyzing...", duration: 1000 }),
                    alwaysSuccess({ name: "Phase Alpha Complete" })
                ]),
                sequence({ name: "Phase Beta" }, [
                    action({
                        name: "Hack Console",
                        requireSustainedSuccess: 3,
                        execute: () => randomChance(0.8) ? NodeResult.Succeeded : NodeResult.Failed
                    }),
                    alwaysFailure({ name: "System Lockdown" })
                ])
            ]),

            // 5. Emotional Brain (Utility Framework)
            utilityFallback({ name: "Needs" }, [
                utility({
                    scorer: () => hunger.value > 80 ? 1.0 : 0.0,
                    name: "Scorer: Hunger"
                }, action({
                    name: "Eat Snack",
                    execute: () => { hunger.value = 0; return NodeResult.Succeeded; }
                })),
                utility({
                    scorer: () => thirst.value > 80 ? 0.9 : 0.0,
                    name: "Scorer: Thirst"
                }, action({
                    name: "Drink Water",
                    execute: () => { thirst.value = 0; return NodeResult.Succeeded; }
                }))
            ]),

            // 6. Idle Activities (UtilitySequence & Misc)
            utilitySequence({ name: "Idle Plan" }, [
                utility({ scorer: () => 0.5 }, action({ name: "Whistle", execute: () => NodeResult.Succeeded })),
                utility({ scorer: () => 0.3 }, action({ name: "Stretch", execute: () => NodeResult.Succeeded }))
            ]),

            // 7. Guards and Modifiers
            sequence({
                name: "Guard Demo",
                failIf: { name: 'Fail by chance', condition: () => randomChance(0.05) },
                inverter: true,
                delay: 500
            }, [
                alwaysFailure({
                    name: "Will be Succeeded because of Inverter",
                    succeedIf: { condition: () => randomChance(0.1) },
                })
            ]),

            sequence({
                name: "Status Flags",
                runningIsSuccess: true,
                forceSuccess: true,
                keepRunningUntilFailure: true
            }, [
                alwaysRunning({ name: "Background Noise" })
            ]),

            sequence({
                name: "Failure Handling",
                runningIsFailure: true,
                forceFailure: false // already false by default but let's be explicit
            }, [
                alwaysRunning({
                    name: "Ghost Process",
                    forceFailure: true,
                    repeat: 3,
                    onFinished: (res) => console.log(`Finished with ${res}`),
                    onAbort: () => console.log("Aborted!")
                })
            ]),

            sequence({
                name: "Lifecycle Hooks",
                onResume: () => console.log("Resuming..."),
                onSuccessOrRunning: () => console.log("Success or Running"),
                onFailedOrRunning: () => console.log("Failed or Running"),
            }, [
                action({
                    name: "Tickable Action",
                    execute: () => NodeResult.Succeeded
                })
            ]),

            alwaysRunning({
                name: "Heartbeat",
                onReset: () => console.log("Re-initializing heartbeat...")
            })
        ])
    ).enableTrace();
};

const TICK_RATE = 20;
const UPDATE_RATE = TICK_RATE * 15;

function App() {
    const [tree] = useState(() => createSampleTree());
    const [ticks, setTicks] = useState<TickRecord[]>([]);
    const serializedTree = useMemo(() => tree.serialize(), [tree]);

    const handleTick = useCallback(() => {
        const tickRecords = Array.from({ length: Math.floor(UPDATE_RATE / TICK_RATE) }).map(() => tree.tick({}));
        setTicks((prev) => [...prev, ...tickRecords]);
    }, [tree]);

    useEffect(() => {
        const interval = setInterval(handleTick, UPDATE_RATE);
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
                        maxTicks: (1000 / TICK_RATE) * 5
                    }} />
            </main>
        </div>
    );
}

export default App;
