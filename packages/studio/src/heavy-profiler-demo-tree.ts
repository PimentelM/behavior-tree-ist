import * as coreModule from '@behavior-tree-ist/core';
import type { BehaviourTree as BehaviourTreeType } from '@behavior-tree-ist/core';
import * as builderModule from '@behavior-tree-ist/core/builder';
import { unwrapDefaultExport } from './module-interop';

const { BehaviourTree, NodeResult, ref, Tag } = unwrapDefaultExport(coreModule) as typeof import('@behavior-tree-ist/core');
const {
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
    displayState,
    subTree
} = unwrapDefaultExport(builderModule) as typeof import('@behavior-tree-ist/core/builder');

type Point = { x: number; y: number; threat: number };
type LoadProfile = 'light' | 'medium' | 'heavy' | 'extreme';

const DEFAULT_LOAD_PROFILE: LoadProfile = 'heavy';

const LOAD_MULTIPLIER: Record<LoadProfile, number> = {
    light: 1,
    medium: 2.5,
    heavy: 5,
    extreme: 8
};

function createSeededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function cpuBurst(units: number, seed: number): number {
    const iterations = Math.max(200, units);
    let acc = (seed ^ 0x9e3779b9) >>> 0;
    for (let i = 0; i < iterations; i += 1) {
        acc = (acc * 1664525 + 1013904223) >>> 0;
        acc ^= acc << 13;
        acc ^= acc >>> 17;
        acc ^= acc << 5;
        acc = (acc + i) >>> 0;
    }
    return acc >>> 0;
}

function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function generateThreatPoints(seed: number, count: number): Point[] {
    const random = createSeededRandom(seed);
    return Array.from({ length: count }, () => ({
        x: Math.round((random() * 180) - 90),
        y: Math.round((random() * 180) - 90),
        threat: Math.round(random() * 100)
    }));
}

export function createHeavyProfilerDemoTree(): BehaviourTreeType {
    const multiplier = LOAD_MULTIPLIER[DEFAULT_LOAD_PROFILE];
    const scale = (base: number) => Math.max(1, Math.floor(base * multiplier));

    const hp = ref(100, 'hp');
    const stamina = ref(80, 'stamina');
    const mana = ref(50, 'mana');
    const ammo = ref(30, 'ammo');
    const enemyHp = ref(220, 'enemy-hp');
    const enemyVisible = ref(false, 'enemy-visible');
    const alertLevel = ref(0, 'alert-level');
    const agentX = ref(0, 'agent-x');
    const agentY = ref(0, 'agent-y');

    const hunger = ref(0, 'hunger');
    const thirst = ref(0, 'thirst');
    const fatigue = ref(0, 'fatigue');

    const threatPoints = ref(generateThreatPoints(1337, 40), 'threat-points');
    const nearestThreatId = ref(-1, 'nearest-threat-id');
    const nearestDistanceSq = ref(Number.POSITIVE_INFINITY, 'nearest-distance-sq');
    const bestWaypointId = ref(-1, 'best-waypoint-id');
    const tickCounter = ref(0, 'tick-counter');
    const worldPhase = ref('patrol', 'world-phase');

    const perceptionMs = ref(0, 'perception-ms');
    const navigationMs = ref(0, 'navigation-ms');
    const combatMs = ref(0, 'combat-ms');
    const utilityMs = ref(0, 'utility-ms');

    const diagnosticAccumulator = ref(0, 'diagnostic-accumulator');
    const heartbeatLoops = ref(0, 'heartbeat-loops');
    const targetLockStreak = ref(0, 'target-lock-streak');

    const supressedLog = (_msg: string) => {
        // console.log(_msg);
    };

    const worldRandom = createSeededRandom(2026);

    return new BehaviourTree(
        subTree({ name: 'Guard Npc Demo', namespace: 'npc-guard', id: 'npc-guard-bt' },
            parallel({
                name: 'GuardAgentDemoRoot',
                activity: 'Guarding',
                policy: () => NodeResult.Running,
                tag: 'demo',
                onTicked: (result) => supressedLog(`Root ticked: ${result}`)
            }, [
                sequence({
                    name: 'WorldSimulation',
                    activity: 'World Simulation',
                    tag: 'world-sim'
                }, [
                    sequence({
                        name: 'WorldFrame',
                        onEnter: () => supressedLog('World simulation started'),
                        throttle: 20
                    }, [
                        action({
                            name: 'AdvanceClockAndVitals',
                            execute: (ctx) => {
                                tickCounter.set(tickCounter.value + 1, ctx);
                                const cycle = tickCounter.value % 360;
                                const phase = cycle < 90 ? 'patrol' : cycle < 180 ? 'investigate' : cycle < 270 ? 'engage' : 'recover';
                                worldPhase.set(phase, ctx);

                                hunger.set(Math.min(100, hunger.value + 0.14), ctx);
                                thirst.set(Math.min(100, thirst.value + 0.18), ctx);
                                fatigue.set(Math.min(100, fatigue.value + 0.09), ctx);

                                const regen = phase === 'recover' ? 0.55 : 0.18;
                                hp.set(Math.max(0, Math.min(100, hp.value + regen - (phase === 'engage' ? 0.45 : 0.12))), ctx);
                                stamina.set(Math.max(0, Math.min(100, stamina.value + (phase === 'recover' ? 1.1 : -0.25))), ctx);
                                mana.set(Math.max(0, Math.min(100, mana.value + 0.4)), ctx);
                                ammo.set(Math.max(0, Math.min(40, ammo.value + (phase === 'recover' ? 0.4 : 0))), ctx);

                                const xDelta = Math.sin(cycle * 0.07) * 0.8;
                                const yDelta = Math.cos(cycle * 0.05) * 0.8;
                                agentX.set(agentX.value + xDelta, ctx);
                                agentY.set(agentY.value + yDelta, ctx);

                                const noise = cpuBurst(scale(1500), tickCounter.value);
                                alertLevel.set(Math.min(100, Math.floor((noise % 45) + (phase === 'engage' ? 45 : 10))), ctx);
                                return NodeResult.Succeeded;
                            },
                            onSuccess: () => supressedLog('World frame advanced')
                        }),
                        action({
                            name: 'DriftThreatPoints',
                            execute: (ctx) => {
                                const nextThreats = threatPoints.value.map((point, index) => {
                                    const driftSeed = cpuBurst(scale(70), (index + 1) * (tickCounter.value + 11));
                                    const driftX = ((driftSeed & 15) - 7) * 0.05;
                                    const driftY = (((driftSeed >>> 5) & 15) - 7) * 0.05;
                                    return {
                                        x: point.x + driftX,
                                        y: point.y + driftY,
                                        threat: Math.max(0, Math.min(100, point.threat + (((driftSeed >>> 9) & 7) - 3)))
                                    };
                                });
                                threatPoints.set(nextThreats, ctx);
                                enemyVisible.set((tickCounter.value % 8) >= 2, ctx);
                                return NodeResult.Succeeded;
                            },
                            onTicked: () => supressedLog('Threat points drifted')
                        })
                    ])
                ]),

                sequence({
                    name: 'Perception',
                    activity: 'Perception',
                    tag: 'perception'
                }, [
                    sequence({
                        name: 'SensorSweep',
                        activity: 'Targeting',
                        tags: ['sensor', 'heavy'],
                        onRunning: () => supressedLog('Perception running'),
                        throttle: 180,
                        onResume: () => supressedLog('Resuming sensor sweep')
                    }, [
                        sequence({ name: 'GeometryPipeline' }, [
                            action({
                                name: 'NormalizeThreatCoordinates',
                                execute: () => {
                                    let normAcc = 0;
                                    for (let i = 0; i < threatPoints.value.length; i += 1) {
                                        const point = threatPoints.value[i];
                                        normAcc += Math.abs(point.x * 0.07) + Math.abs(point.y * 0.07);
                                        cpuBurst(scale(220), tickCounter.value + i + 7);
                                    }
                                    alertLevel.value = Math.max(alertLevel.value, Math.min(100, Math.floor(normAcc % 100)));
                                    return NodeResult.Succeeded;
                                }
                            }),
                            action({
                                name: 'AcquireNearestThreatSync',
                                execute: (ctx) => {
                                    const start = nowMs();
                                    let bestIndex = -1;
                                    let bestDistanceSq = Number.POSITIVE_INFINITY;

                                    for (let i = 0; i < threatPoints.value.length; i += 1) {
                                        const point = threatPoints.value[i];
                                        const dx = point.x - agentX.value;
                                        const dy = point.y - agentY.value;
                                        const distanceSq = (dx * dx) + (dy * dy);

                                        cpuBurst(scale(900), (i + 1) * (tickCounter.value + 17));

                                        if (distanceSq < bestDistanceSq) {
                                            bestDistanceSq = distanceSq;
                                            bestIndex = i;
                                        }
                                    }

                                    nearestThreatId.set(bestIndex, ctx);
                                    nearestDistanceSq.set(bestDistanceSq, ctx);
                                    perceptionMs.set(nowMs() - start, ctx);
                                    return NodeResult.Succeeded;
                                },
                                cooldown: 40
                            })
                        ]),
                        sequence({ name: 'ThreatScoringPipeline' }, [
                            action({
                                name: 'ComputeExposureHeatmap',
                                execute: () => {
                                    let heat = 0;
                                    for (let ring = 0; ring < scale(24); ring += 1) {
                                        const angle = (ring * Math.PI * 2) / Math.max(1, scale(24));
                                        const sample = Math.abs(Math.sin(angle + (tickCounter.value * 0.015))) * 100;
                                        heat += sample + (cpuBurst(scale(35), ring + tickCounter.value) % 12);
                                    }
                                    alertLevel.value = Math.max(alertLevel.value, Math.min(100, Math.floor(heat % 100)));
                                    return NodeResult.Succeeded;
                                }
                            }),
                            action({
                                name: 'MediumThreatClusterPass',
                                execute: () => {
                                    let clusterScore = 0;
                                    for (let i = 0; i < threatPoints.value.length; i += 1) {
                                        const base = cpuBurst(scale(45), tickCounter.value + i + 501);
                                        clusterScore += (base % 19) + (threatPoints.value[i].threat * 0.1);
                                    }
                                    alertLevel.value = Math.max(alertLevel.value, Math.min(100, Math.floor(clusterScore % 100)));
                                    return NodeResult.Succeeded;
                                }
                            }),
                            action({
                                name: 'EvaluateCoverAndVisibility',
                                execute: (ctx) => {
                                    const start = nowMs();
                                    let visibilityScore = 0;
                                    for (let ray = 0; ray < scale(80); ray += 1) {
                                        const angle = (ray * 2 * Math.PI) / Math.max(1, scale(80));
                                        const sample = Math.abs(Math.sin(angle + (tickCounter.value * 0.01))) * 100;
                                        visibilityScore += sample;
                                    }

                                    const normalized = Math.floor((visibilityScore / Math.max(1, scale(80))) + (worldRandom() * 4));
                                    alertLevel.set(Math.max(alertLevel.value, Math.min(100, normalized)), ctx);
                                    navigationMs.set(nowMs() - start, ctx);
                                    return NodeResult.Succeeded;
                                },
                                delay: 15
                            })
                        ]),
                        condition({
                            name: 'TargetLockStable',
                            eval: () => {
                                const locked = nearestThreatId.value >= 0 && nearestDistanceSq.value < 2800;
                                targetLockStreak.value = locked ? targetLockStreak.value + 1 : 0;
                                return locked;
                            },
                            requireSustainedSuccess: 180
                        }),
                        displayState({
                            name: 'PerceptionHUD',
                            display: () => ({
                                nearestThreatId: nearestThreatId.value,
                                nearestDistanceSq: Math.round(nearestDistanceSq.value),
                                perceptionMs: perceptionMs.value.toFixed(3),
                                navigationMs: navigationMs.value.toFixed(3),
                                lockStreak: targetLockStreak.value
                            }),
                            inputs: [agentX, agentY, threatPoints],
                            outputs: [nearestThreatId, nearestDistanceSq],
                            onRunning: () => supressedLog('Perception HUD active')
                        })
                    ])
                ]),

                sequence({
                    name: 'DecisionAndExecution',
                    activity: 'Hunting',
                    tag: 'decision-exec'
                }, [
                    selector({
                        name: 'HighLevelIntent',
                        activity: 'Intent',
                        onFailedOrRunning: () => supressedLog('Decision branch failed or running'),
                        onSuccessOrRunning: () => supressedLog('Decision branch success or running'),
                        onFailure: () => supressedLog('No intent available')
                    }, [
                        sequence({
                            name: 'EngageIntent',
                            activity: 'Combat',
                            precondition: { name: 'EnemyVisible', condition: () => enemyVisible.value },
                            onEnter: () => supressedLog('Entering engage intent')
                        }, [
                            ifThenElse({ name: 'CriticalHealthDecision' }, [
                                condition({ name: 'IsCriticalHP', eval: () => hp.value < 28 }),
                                selectorWithMemory({ name: 'RetreatPlan', onResume: () => supressedLog('Retreat resumed') }, [
                                    sequence({ name: 'FindSafeWaypoint', retry: 2 }, [
                                        action({
                                            name: 'ComputeWaypointScores',
                                            execute: (ctx) => {
                                                const start = nowMs();
                                                let bestScore = Number.NEGATIVE_INFINITY;
                                                let bestIndex = -1;
                                                for (let i = 0; i < threatPoints.value.length; i += 1) {
                                                    const point = threatPoints.value[i];
                                                    const dx = point.x - agentX.value;
                                                    const dy = point.y - agentY.value;
                                                    const d2 = dx * dx + dy * dy;
                                                    const score = (d2 * 0.3) - (point.threat * 2.4) + (cpuBurst(scale(100), i + tickCounter.value) % 30);
                                                    if (score > bestScore) {
                                                        bestScore = score;
                                                        bestIndex = i;
                                                    }
                                                }
                                                bestWaypointId.set(bestIndex, ctx);
                                                navigationMs.set(nowMs() - start, ctx);
                                                return bestIndex >= 0 ? NodeResult.Succeeded : NodeResult.Failed;
                                            },
                                            onFinished: () => supressedLog('Waypoint scoring finished')
                                        }),
                                        sleep({ name: 'RelocateToCover', duration: 140, onRunning: () => supressedLog('Relocating...') }),
                                        alwaysSuccess({ name: 'CoverReached' })
                                    ]),
                                    action({ name: 'FallbackCallBackup', execute: () => NodeResult.Succeeded, cooldown: 400 })
                                ]),
                                sequenceWithMemory({
                                    name: 'AttackPlan',
                                    timeout: 850,
                                    onResume: () => supressedLog('Attack plan resumed'),
                                    onFailedOrRunning: () => supressedLog('Attack unstable')
                                }, [
                                    condition({ name: 'HasAmmo', eval: () => ammo.value > 0 }),
                                    sequence({ name: 'TargetingPipeline', activity: 'Targeting' }, [
                                        action({
                                            name: 'SmoothAimJitter',
                                            execute: () => {
                                                let jitter = 0;
                                                for (let i = 0; i < scale(900); i += 1) {
                                                    jitter += (cpuBurst(12, i + tickCounter.value + 33) % 7) - 3;
                                                }
                                                alertLevel.value = Math.max(0, Math.min(100, alertLevel.value + (jitter % 3)));
                                                return NodeResult.Succeeded;
                                            }
                                        }),
                                        action({
                                            name: 'HeavyTrajectoryMonteCarlo',
                                            execute: () => {
                                                let monteCarlo = 0;
                                                for (let i = 0; i < scale(1200); i += 1) {
                                                    monteCarlo += cpuBurst(14, tickCounter.value + i + 640) % 23;
                                                }
                                                stamina.value = Math.max(0, stamina.value - ((monteCarlo % 7) * 0.03));
                                                return NodeResult.Succeeded;
                                            }
                                        }),
                                        action({
                                            name: 'ComputeBallisticSolution',
                                            execute: (ctx) => {
                                                const start = nowMs();
                                                let confidence = 0;
                                                for (let i = 0; i < scale(1800); i += 1) {
                                                    confidence += (cpuBurst(25, i + tickCounter.value) % 100) / 100;
                                                }
                                                const success = confidence > scale(500);
                                                combatMs.set(nowMs() - start, ctx);
                                                return success ? NodeResult.Succeeded : NodeResult.Failed;
                                            },
                                            retry: 1,
                                            onFailure: () => supressedLog('Ballistic solution failed')
                                        }),
                                        action({
                                            name: 'ReconcileRecoilModel',
                                            execute: () => {
                                                let recoil = 0;
                                                for (let i = 0; i < scale(420); i += 1) {
                                                    recoil += cpuBurst(16, tickCounter.value + i + 81) % 11;
                                                }
                                                stamina.value = Math.max(0, stamina.value - ((recoil % 9) * 0.02));
                                                return NodeResult.Succeeded;
                                            }
                                        })
                                    ]),
                                    asyncAction({
                                        name: 'FireBurstAsync',
                                        activity: 'Attacking',
                                        execute: async (ctx, signal) => {
                                            for (let burst = 0; burst < 4; burst += 1) {
                                                if (signal.aborted) {
                                                    return NodeResult.Failed;
                                                }
                                                cpuBurst(scale(1300), burst + tickCounter.value);
                                                await new Promise((resolve) => setTimeout(resolve, 20));
                                            }

                                            const damage = 6 + (cpuBurst(scale(400), tickCounter.value) % 12);
                                            enemyHp.set(Math.max(0, enemyHp.value - damage), ctx);
                                            ammo.set(Math.max(0, ammo.value - 1), ctx);
                                            return NodeResult.Succeeded;
                                        },
                                        onAbort: () => supressedLog('Burst cancelled'),
                                        onSuccess: () => supressedLog('Burst completed')
                                    }),
                                    action({
                                        name: 'PostAttackRecovery',
                                        execute: () => {
                                            stamina.value = Math.max(0, stamina.value - 1.8);
                                            return NodeResult.Succeeded;
                                        },
                                        onSuccess: () => supressedLog('Attack committed')
                                    })
                                ])
                            ])
                        ]),
                        sequence({ name: 'PatrolIntent', activity: 'Movement', delay: 120, repeat: 2 }, [
                            action({
                                name: 'MediumPatrolRiskFieldUpdate',
                                execute: () => {
                                    let risk = 0;
                                    for (let i = 0; i < scale(700); i += 1) {
                                        risk += cpuBurst(13, tickCounter.value + i + 1200) % 29;
                                    }
                                    alertLevel.value = Math.max(0, Math.min(100, alertLevel.value + ((risk % 5) - 2)));
                                    return NodeResult.Succeeded;
                                }
                            }),
                            utilitySequence({ name: 'PatrolTaskOrder', activity: 'Patrolling', cooldown: 120 }, [
                                utility({ scorer: () => (100 - stamina.value) * 1.4 }, action({
                                    name: 'BreathingControl',
                                    execute: () => {
                                        cpuBurst(scale(900), tickCounter.value + 123);
                                        stamina.value = Math.min(100, stamina.value + 0.9);
                                        return NodeResult.Succeeded;
                                    }
                                })),
                                utility({ scorer: () => alertLevel.value + (enemyVisible.value ? 40 : 0) }, action({
                                    name: 'ScanPatrolArc',
                                    execute: () => {
                                        cpuBurst(scale(1300), tickCounter.value + 321);
                                        return NodeResult.Succeeded;
                                    },
                                    throttle: 180
                                }))
                            ]),
                            alwaysSuccess({ name: 'PatrolCycleDone' })
                        ])
                    ])
                ]),

                sequence({
                    name: 'NeedsAndUtility',
                    activity: 'Needs',
                    tag: 'needs'
                }, [
                    utilityFallback({
                        name: 'NeedPrioritization',
                        activity: 'Need Selection',
                        throttle: 140,
                        cooldown: 100,
                        decorate: [[Tag, 'simulation', 'utility', 'needs']]
                    }, [
                        utility({ scorer: () => hunger.value * hunger.value }, sequence({ name: 'HandleHunger', succeedIf: { name: 'HungerAlreadyLow', condition: () => hunger.value < 10 } }, [
                            sequence({ name: 'HungerPipeline' }, [
                                action({
                                    name: 'FindFoodSource',
                                    execute: (ctx) => {
                                        const start = nowMs();
                                        cpuBurst(scale(2200), tickCounter.value + 777);
                                        utilityMs.set(nowMs() - start, ctx);
                                        return NodeResult.Succeeded;
                                    }
                                }),
                                action({
                                    name: 'MediumDigestiveForecast',
                                    execute: () => {
                                        let digestion = 0;
                                        for (let i = 0; i < scale(560); i += 1) {
                                            digestion += cpuBurst(15, tickCounter.value + i + 1401) % 21;
                                        }
                                        mana.value = Math.max(0, Math.min(100, mana.value + ((digestion % 6) * 0.02)));
                                        return NodeResult.Succeeded;
                                    }
                                }),
                                action({
                                    name: 'RankFoodCandidates',
                                    execute: () => {
                                        let rank = 0;
                                        for (let i = 0; i < scale(640); i += 1) {
                                            rank += cpuBurst(14, tickCounter.value + i + 901) % 17;
                                        }
                                        mana.value = Math.max(0, Math.min(100, mana.value + ((rank % 5) * 0.03)));
                                        return NodeResult.Succeeded;
                                    }
                                })
                            ]),
                            action({
                                name: 'ConsumeRation',
                                execute: () => {
                                    hunger.value = Math.max(0, hunger.value - 35);
                                    return NodeResult.Succeeded;
                                },
                                onSuccess: () => supressedLog('Ration consumed')
                            })
                        ])),
                        utility({ scorer: () => thirst.value * thirst.value * 1.2 }, sequence({ name: 'HandleThirst', failIf: { name: 'NoWaterAccess', condition: () => (tickCounter.value % 37) === 0 } }, [
                            sequence({ name: 'HydrationPipeline' }, [
                                action({
                                    name: 'ComputeWaterPath',
                                    execute: () => {
                                        cpuBurst(scale(1700), tickCounter.value + 991);
                                        return NodeResult.Succeeded;
                                    }
                                }),
                                action({
                                    name: 'ValidateRouteSafety',
                                    execute: () => {
                                        let safety = 0;
                                        for (let i = 0; i < scale(520); i += 1) {
                                            safety += cpuBurst(18, tickCounter.value + i + 1101) % 13;
                                        }
                                        stamina.value = Math.max(0, stamina.value - ((safety % 8) * 0.01));
                                        return NodeResult.Succeeded;
                                    }
                                })
                            ]),
                            action({
                                name: 'Drink',
                                execute: () => {
                                    thirst.value = Math.max(0, thirst.value - 45);
                                    return NodeResult.Succeeded;
                                },
                                onFinished: () => supressedLog('Thirst task finished')
                            })
                        ])),
                        utility({ scorer: () => fatigue.value * 0.8 }, action({
                            name: 'MicroRest',
                            execute: () => {
                                fatigue.value = Math.max(0, fatigue.value - 18);
                                return NodeResult.Succeeded;
                            },
                            cooldown: 320
                        }))
                    ])
                ]),

                sequence({
                    name: 'Diagnostics',
                    activity: 'Diagnostics',
                    tag: 'diagnostics'
                }, [
                    parallel({
                        name: 'DiagnosticsParallel',
                        activity: 'Diagnostics Loop',
                        policy: () => NodeResult.Running,
                        tag: 'profiler'
                    }, [
                        sequence({
                            name: 'BootSelfTest',
                            runOnce: true,
                            onEnter: () => supressedLog('Running boot self-test')
                        }, [
                            sequence({ name: 'WarmupPipeline' }, [
                                action({
                                    name: 'WarmupComputation',
                                    execute: (ctx) => {
                                        const warm = cpuBurst(scale(7000), 42 + tickCounter.value);
                                        diagnosticAccumulator.set(warm, ctx);
                                        return NodeResult.Succeeded;
                                    }
                                }),
                                action({
                                    name: 'PrimeCaches',
                                    execute: (ctx) => {
                                        let cachePrime = 0;
                                        for (let i = 0; i < scale(1200); i += 1) {
                                            cachePrime ^= cpuBurst(11, i + tickCounter.value + 71);
                                        }
                                        diagnosticAccumulator.set((diagnosticAccumulator.value ^ cachePrime) >>> 0, ctx);
                                        return NodeResult.Succeeded;
                                    }
                                })
                            ]),
                            alwaysSuccess({ name: 'SelfTestComplete' })
                        ]),

                        sequence({
                            name: 'ResultTransformersShowcase',
                            inverter: true,
                            delay: 60
                        }, [
                            alwaysFailure({
                                name: 'InvertedFailure',
                                succeedIf: { name: 'SkipSometimes', condition: () => (tickCounter.value % 19) === 0 }
                            })
                        ]),

                        sequence({
                            name: 'RunningAsSuccessShowcase',
                            runningIsSuccess: true,
                            forceSuccess: true,
                            keepRunningUntilFailure: true,
                            onTicked: () => {
                                heartbeatLoops.value += 1;
                            }
                        }, [
                            action({
                                name: 'HeartbeatUntilFailure',
                                execute: () => {
                                    cpuBurst(scale(350), tickCounter.value + 5000);
                                    return (tickCounter.value % 23) === 0 ? NodeResult.Failed : NodeResult.Succeeded;
                                },
                                onReset: () => supressedLog('Heartbeat reset')
                            })
                        ]),

                        sequence({
                            name: 'RunningAsFailureShowcase',
                            runningIsFailure: true
                        }, [
                            alwaysRunning({
                                name: 'GhostLoop',
                                forceFailure: true,
                                repeat: 3,
                                onAbort: () => supressedLog('Ghost loop aborted')
                            })
                        ]),

                        sequence({
                            name: 'LifecycleHooksShowcase',
                            onResume: () => supressedLog('Lifecycle sequence resumed'),
                            onSuccessOrRunning: () => supressedLog('Lifecycle success or running'),
                            onFailedOrRunning: () => supressedLog('Lifecycle failed or running')
                        }, [
                            action({
                                name: 'HeavyLifecycleStressStep',
                                execute: (ctx) => {
                                    let lifecycleLoad = 0;
                                    for (let i = 0; i < scale(1400); i += 1) {
                                        lifecycleLoad ^= cpuBurst(10, tickCounter.value + i + 1800);
                                    }
                                    diagnosticAccumulator.set((diagnosticAccumulator.value ^ lifecycleLoad) >>> 0, ctx);
                                    return NodeResult.Succeeded;
                                }
                            }),
                            action({
                                name: 'LifecycleTickAction',
                                execute: () => NodeResult.Succeeded,
                                onEnter: () => supressedLog('Lifecycle action enter'),
                                onRunning: () => supressedLog('Lifecycle action running'),
                                onFailure: () => supressedLog('Lifecycle action failure')
                            })
                        ]),

                        displayState({
                            name: 'ProfilerHUD',
                            display: () => ({
                                loadProfile: DEFAULT_LOAD_PROFILE,
                                tick: tickCounter.value,
                                phase: worldPhase.value,
                                hp: hp.value.toFixed(1),
                                stamina: stamina.value.toFixed(1),
                                ammo: ammo.value.toFixed(0),
                                enemyHp: enemyHp.value.toFixed(0),
                                perceptionMs: perceptionMs.value.toFixed(3),
                                navigationMs: navigationMs.value.toFixed(3),
                                combatMs: combatMs.value.toFixed(3),
                                utilityMs: utilityMs.value.toFixed(3),
                                diagnostics: diagnosticAccumulator.value,
                                loops: heartbeatLoops.value
                            }),
                            forceSuccess: true,
                            tags: ['ui', 'debug']
                        })
                    ])
                ]),

                alwaysRunning({
                    name: 'AmbientHeartbeat',
                    activity: 'Idle',
                    onReset: () => supressedLog('Ambient heartbeat reset')
                })
            ]))
    ).enableStateTrace().enableProfiling(() => performance.now());
}
