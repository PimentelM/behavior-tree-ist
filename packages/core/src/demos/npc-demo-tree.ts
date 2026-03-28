/// <reference lib="dom" />
import {
    BehaviourTree, NodeResult, ref, multiRef,
    action, asyncAction, condition,
    parallel, sequence, selector,
    ifThenElse, sequenceWithMemory, selectorWithMemory,
    utilityFallback, utilitySequence, utility,
    alwaysRunning, alwaysSuccess, alwaysFailure,
    sleep, displayState, displayNote, displayProgress, subTree,
    type Displayable,
} from '../index.js'

type Item = { id: number; x: number; y: number; type: string; collected: boolean }

const WAYPOINTS = [
    { name: 'Village Gate', x: 0, y: 0 },
    { name: 'Forest Edge', x: 20, y: 5 },
    { name: 'River Crossing', x: 30, y: -10 },
    { name: 'Hilltop Lookout', x: 15, y: -25 },
    { name: 'Abandoned Mine', x: -10, y: -20 },
    { name: 'Old Chapel', x: -25, y: -5 },
    { name: 'Merchant Camp', x: -15, y: 15 },
    { name: 'Ruins', x: 10, y: 20 },
]

const MERCHANT_X = -15
const MERCHANT_Y = 15

function dist(ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax
    const dy = by - ay
    return Math.sqrt(dx * dx + dy * dy)
}

function stepToward(fx: number, fy: number, tx: number, ty: number, spd: number): { x: number; y: number } {
    const d = dist(fx, fy, tx, ty)
    if (d <= spd) return { x: tx, y: ty }
    return { x: fx + ((tx - fx) / d) * spd, y: fy + ((ty - fy) / d) * spd }
}

class CharacterStatus implements Displayable {
    constructor(public level: number, public activity: string) {}
    toDisplayString(): string { return `Lv.${this.level} ${this.activity}` }
}

export function createNpcDemoTree(): BehaviourTree {
    // Vitals
    const hp = ref(100, 'hp')
    const maxHp = ref(100, 'max-hp')
    const stamina = ref(100, 'stamina')
    const mana = ref(50, 'mana')
    const hunger = ref(0, 'hunger')
    const gold = ref(40, 'gold')
    const level = ref(1, 'level')
    const xp = ref(0, 'xp')

    // Position & Navigation
    const posX = ref(0, 'pos-x')
    const posY = ref(0, 'pos-y')
    const moveSpeed = ref(1.5, 'move-speed')
    const heading = ref(0, 'heading')

    // Patrol
    const waypointIndex = ref(0, 'waypoint-index')
    const patrolDirection = ref(1, 'patrol-dir')
    const atWaypoint = ref(false, 'at-waypoint')
    const waypointsVisited = ref(0, 'waypoints-visited')

    // Enemy
    const enemyDetected = ref(false, 'enemy-detected')
    const enemyDistance = ref(9999, 'enemy-dist')
    const enemyHp = ref(100, 'enemy-hp')
    const enemyType = ref('goblin', 'enemy-type')
    const enemyX = ref(50, 'enemy-x')
    const enemyY = ref(50, 'enemy-y')
    const inCombat = ref(false, 'in-combat')
    const combatRounds = ref(0, 'combat-rounds')
    const damageDealt = ref(0, 'damage-dealt')
    const damageTaken = ref(0, 'damage-taken')
    const killCount = ref(0, 'kill-count')

    // Items & Inventory
    const items = ref<Item[]>([
        { id: 1, x: 25, y: 2, type: 'herb', collected: false },
        { id: 2, x: -8, y: -18, type: 'gem', collected: false },
        { id: 3, x: 12, y: 18, type: 'scroll', collected: false },
    ], 'items')
    const inventory = ref<string[]>(['potion'], 'inventory')
    const targetItemId = ref(-1, 'target-item-id')
    const carryingItems = ref(0, 'carrying-items')
    const itemsDelivered = ref(0, 'items-delivered')

    // World
    const tickCount = ref(0, 'tick-count')
    const timeOfDay = ref(20, 'time-of-day')
    const weather = ref('clear', 'weather')
    const alertLevel = ref(0, 'alert-level')
    const currentActivity = ref('idle', 'activity')

    // Flags
    const isResting = ref(false, 'is-resting')
    const isHealing = ref(false, 'is-healing')
    const isFleeing = ref(false, 'is-fleeing')
    const isNearBase = ref(true, 'is-near-base')

    // Grouped refs (multiRef creates dotted names for UI grouping)
    const stats = multiRef('stats', { str: 10, agi: 12, wis: 8, luck: 5 })
    const quest = multiRef('quest', { name: 'patrol', progress: 0, stage: 1 })

    // Displayable ref (UI shows toDisplayString() instead of raw JSON)
    const charStatus = ref<CharacterStatus>(new CharacterStatus(1, 'idle'), 'char-status')

    return new BehaviourTree(
        subTree({ name: 'NPC Adventurer Demo', namespace: 'npc', id: 'npc-adventure-bt' },
            parallel({
                name: 'AdventurerRoot',
                activity: 'Adventuring',
                policy: () => NodeResult.Running,
                tag: 'root',
            }, [

                // ================================================================
                // 1. WORLD SIMULATION
                // ================================================================
                subTree({ name: 'WorldSimulation', namespace: 'world', id: 'world-sim' },
                    sequence({ name: 'WorldFrame', tag: 'world-sim' }, [
                        action({
                            name: 'AdvanceClock',
                            execute: (ctx) => {
                                tickCount.set(tickCount.value + 1, ctx)
                                timeOfDay.set((timeOfDay.value + 0.2) % 100, ctx)
                                return NodeResult.Succeeded
                            },
                        }),
                        action({
                            name: 'UpdateDemoRefs',
                            execute: (ctx) => {
                                const t = tickCount.value
                                stats.str = 10 + Math.floor(t / 100) % 5
                                stats.agi = 12 + Math.floor(t / 80) % 4
                                stats.wis = 8 + Math.floor(t / 120) % 3
                                stats.luck = 5 + Math.floor(t / 200) % 6
                                const questNames = ['patrol', 'gather', 'escort', 'hunt']
                                const questIdx = Math.floor(t / 50) % questNames.length
                                quest.name = questNames[questIdx]!
                                quest.progress = (t % 50) / 50
                                quest.stage = 1 + Math.floor(t / 200)
                                charStatus.set(new CharacterStatus(level.value, currentActivity.value), ctx)
                                return NodeResult.Succeeded
                            },
                            throttle: 5,
                        }),
                        action({
                            name: 'UpdateWeather',
                            execute: (ctx) => {
                                const t = tickCount.value
                                const w = t % 300 < 200 ? 'clear' : t % 300 < 260 ? 'cloudy' : 'storm'
                                weather.set(w, ctx)
                                return NodeResult.Succeeded
                            },
                            throttle: 30,
                        }),
                        action({
                            name: 'DrainVitals',
                            execute: (ctx) => {
                                hunger.set(Math.min(100, hunger.value + 0.15), ctx)
                                stamina.set(Math.max(0, stamina.value - (inCombat.value ? 0.25 : 0.08)), ctx)
                                mana.set(Math.min(100, mana.value + 0.12), ctx)
                                return NodeResult.Succeeded
                            },
                        }),
                        action({
                            name: 'SpawnEnemies',
                            execute: (ctx) => {
                                const cycle = tickCount.value % 500
                                const t = tickCount.value * 0.018
                                enemyX.set(Math.sin(t) * 28, ctx)
                                enemyY.set(Math.cos(t * 0.8) * 22, ctx)
                                const d = dist(posX.value, posY.value, enemyX.value, enemyY.value)
                                enemyDistance.set(d, ctx)
                                const wasDetected = enemyDetected.value
                                enemyDetected.set(cycle >= 80 && cycle < 320 && d < 22, ctx)
                                if (wasDetected && !enemyDetected.value) {
                                    inCombat.set(false, ctx)
                                    isFleeing.set(false, ctx)
                                }
                                const types = ['goblin', 'wolf', 'bandit', 'orc']
                                enemyType.set(types[Math.floor(cycle / 80) % types.length] as string, ctx)
                                return NodeResult.Succeeded
                            },
                            throttle: 5,
                        }),
                        action({
                            name: 'RespawnItems',
                            execute: (ctx) => {
                                const allCollected = items.value.every(i => i.collected)
                                if (allCollected) {
                                    items.set(items.value.map(i => ({ ...i, collected: false })), ctx)
                                }
                                carryingItems.set(inventory.value.filter(v => v !== 'potion').length, ctx)
                                return NodeResult.Succeeded
                            },
                            throttle: 100,
                        }),
                        action({
                            name: 'UpdateIsNearBase',
                            execute: (ctx) => {
                                isNearBase.set(dist(posX.value, posY.value, 0, 0) < 8, ctx)
                                return NodeResult.Succeeded
                            },
                        }),
                        displayState({
                            name: 'WorldHUD',
                            display: () => ({
                                tick: tickCount.value,
                                time: timeOfDay.value.toFixed(1),
                                weather: weather.value,
                                enemy: enemyDetected.value ? `${enemyType.value} @${enemyDistance.value.toFixed(1)}` : 'none',
                            }),
                            inputs: [tickCount, timeOfDay, weather, enemyDetected],
                            forceSuccess: true,
                        }),
                        displayNote({
                            name: 'DemoNote',
                            text: 'NPC Adventurer — patrol, combat, survival demo',
                        }),
                        displayProgress({
                            name: 'HpBar',
                            progress: () => ({ progress: hp.value / maxHp.value, label: 'HP' }),
                        }),
                    ])
                ),

                // ================================================================
                // 2. SURVIVAL
                // ================================================================
                subTree({ name: 'Survival', namespace: 'survival', id: 'survival' },
                    utilityFallback({ name: 'SurvivalPriority', tag: 'survival', throttle: 20 }, [
                        utility({ scorer: () => hp.value < 30 ? 200 : 0 },
                            sequence({ name: 'EmergencyHeal' }, [
                                condition({ name: 'NeedsHeal', eval: () => hp.value < 30 }),
                                condition({ name: 'HasPotion', eval: () => inventory.value.includes('potion') }),
                                action({
                                    name: 'UsePotion',
                                    execute: (ctx) => {
                                        hp.set(Math.min(maxHp.value, hp.value + 50), ctx)
                                        inventory.set(inventory.value.filter(v => v !== 'potion'), ctx)
                                        isHealing.set(true, ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                                sleep({ name: 'HealingRest', duration: 60 }),
                                action({
                                    name: 'FinishHeal',
                                    execute: (ctx) => { isHealing.set(false, ctx); return NodeResult.Succeeded },
                                }),
                            ])
                        ),
                        utility({ scorer: () => hunger.value > 30 ? hunger.value : 0 },
                            sequence({ name: 'HandleHunger', succeedIf: { name: 'NotHungry', condition: () => hunger.value < 30 } }, [
                                selector({ name: 'FoodOptions' }, [
                                    sequence({ name: 'EatHerb' }, [
                                        condition({ name: 'HasHerb', eval: () => inventory.value.includes('herb') }),
                                        action({
                                            name: 'ConsumeHerb',
                                            execute: (ctx) => {
                                                hunger.set(Math.max(0, hunger.value - 30), ctx)
                                                inventory.set(inventory.value.filter(v => v !== 'herb'), ctx)
                                                return NodeResult.Succeeded
                                            },
                                        }),
                                    ]),
                                    action({
                                        name: 'ForageFood',
                                        execute: (ctx) => {
                                            hunger.set(Math.max(0, hunger.value - 20), ctx)
                                            return NodeResult.Succeeded
                                        },
                                        cooldown: 300,
                                    }),
                                ]),
                            ])
                        ),
                        utility({ scorer: () => stamina.value < 20 ? (20 - stamina.value) * 3 : 0 },
                            sequence({ name: 'RestToRecover' }, [
                                condition({ name: 'LowStamina', eval: () => stamina.value < 20 }),
                                action({
                                    name: 'SitDown',
                                    execute: (ctx) => { isResting.set(true, ctx); return NodeResult.Succeeded },
                                }),
                                sleep({ name: 'RestSleep', duration: 100 }),
                                action({
                                    name: 'StandUp',
                                    execute: (ctx) => {
                                        stamina.set(Math.min(100, stamina.value + 40), ctx)
                                        isResting.set(false, ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                            ])
                        ),
                        utility({ scorer: () => mana.value < 20 ? (20 - mana.value) * 2 : 0 },
                            sequenceWithMemory({ name: 'MeditateAtChapel', timeout: 800 }, [
                                condition({ name: 'LowMana', eval: () => mana.value < 20 }),
                                asyncAction({
                                    name: 'TravelToChapel',
                                    activity: 'Travelling',
                                    execute: async (ctx, signal) => {
                                        const chapel = WAYPOINTS[5] as (typeof WAYPOINTS)[number] // Old Chapel
                                        while (dist(posX.value, posY.value, chapel.x, chapel.y) > 2) {
                                            if (signal.aborted) return NodeResult.Failed
                                            const p = stepToward(posX.value, posY.value, chapel.x, chapel.y, moveSpeed.value)
                                            posX.set(p.x, ctx)
                                            posY.set(p.y, ctx)
                                            await new Promise(r => setTimeout(r, 40))
                                        }
                                        return NodeResult.Succeeded
                                    },
                                }),
                                action({
                                    name: 'BeginMeditation',
                                    execute: (ctx) => { currentActivity.set('meditating', ctx); return NodeResult.Succeeded },
                                }),
                                asyncAction({
                                    name: 'Meditate',
                                    activity: 'Meditating',
                                    execute: async (ctx, signal) => {
                                        while (mana.value < 80) {
                                            if (signal.aborted) return NodeResult.Failed
                                            mana.set(Math.min(100, mana.value + 5), ctx)
                                            await new Promise(r => setTimeout(r, 80))
                                        }
                                        return NodeResult.Succeeded
                                    },
                                }),
                                action({
                                    name: 'EndMeditation',
                                    execute: (ctx) => { currentActivity.set('idle', ctx); return NodeResult.Succeeded },
                                }),
                            ])
                        ),
                    ])
                ),

                // ================================================================
                // 3. COMBAT
                // ================================================================
                subTree({ name: 'CombatBranch', namespace: 'combat', id: 'combat' },
                    sequence({
                        name: 'CombatGate',
                        tag: 'combat',
                        precondition: { name: 'EnemyInRange', condition: () => enemyDetected.value },
                    }, [
                        action({
                            name: 'AssessThreat',
                            execute: (ctx) => {
                                alertLevel.set(Math.min(100, alertLevel.value + 20), ctx)
                                return NodeResult.Succeeded
                            },
                        }),
                        ifThenElse({ name: 'EngageOrFlee' }, [
                            condition({ name: 'CanFight', eval: () => hp.value > 25 && stamina.value > 15 && enemyHp.value < hp.value * 2 }),
                            sequenceWithMemory({ name: 'EngageCombat', activity: 'Fighting', timeout: 1200 }, [
                                asyncAction({
                                    name: 'ApproachEnemy',
                                    activity: 'Closing In',
                                    execute: async (ctx, signal) => {
                                        while (dist(posX.value, posY.value, enemyX.value, enemyY.value) > 3) {
                                            if (signal.aborted) return NodeResult.Failed
                                            const p = stepToward(posX.value, posY.value, enemyX.value, enemyY.value, moveSpeed.value)
                                            posX.set(p.x, ctx)
                                            posY.set(p.y, ctx)
                                            await new Promise(r => setTimeout(r, 40))
                                        }
                                        inCombat.set(true, ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                                selector({ name: 'AttackSelector' }, [
                                    sequence({ name: 'MeleeCombo', repeat: 3 }, [
                                        asyncAction({
                                            name: 'SwingSword',
                                            activity: 'Attacking',
                                            execute: async (ctx, signal) => {
                                                await new Promise(r => setTimeout(r, 50))
                                                if (signal.aborted) return NodeResult.Failed
                                                const dmg = 8 + (tickCount.value % 5)
                                                enemyHp.set(Math.max(0, enemyHp.value - dmg), ctx)
                                                damageDealt.set(damageDealt.value + dmg, ctx)
                                                combatRounds.set(combatRounds.value + 1, ctx)
                                                stamina.set(Math.max(0, stamina.value - 5), ctx)
                                                return NodeResult.Succeeded
                                            },
                                        }),
                                        action({
                                            name: 'EnemyCounterattack',
                                            execute: (ctx) => {
                                                const dmg = 3 + (tickCount.value % 4)
                                                hp.set(Math.max(0, hp.value - dmg), ctx)
                                                damageTaken.set(damageTaken.value + dmg, ctx)
                                                return NodeResult.Succeeded
                                            },
                                        }),
                                    ]),
                                    sequence({ name: 'MagicAttack' }, [
                                        condition({ name: 'HasMana', eval: () => mana.value >= 15 }),
                                        asyncAction({
                                            name: 'CastFirebolt',
                                            activity: 'Casting',
                                            execute: async (ctx, signal) => {
                                                await new Promise(r => setTimeout(r, 80))
                                                if (signal.aborted) return NodeResult.Failed
                                                const dmg = 20 + (tickCount.value % 8)
                                                enemyHp.set(Math.max(0, enemyHp.value - dmg), ctx)
                                                damageDealt.set(damageDealt.value + dmg, ctx)
                                                mana.set(Math.max(0, mana.value - 15), ctx)
                                                return NodeResult.Succeeded
                                            },
                                            cooldown: 120,
                                        }),
                                    ]),
                                ]),
                                sequence({ name: 'CollectVictoryLoot' }, [
                                    condition({ name: 'EnemyDefeated', eval: () => enemyHp.value <= 0 }),
                                    action({
                                        name: 'ClaimXpAndGold',
                                        execute: (ctx) => {
                                            const earned = 15 + (tickCount.value % 10)
                                            xp.set(xp.value + earned, ctx)
                                            gold.set(gold.value + 5, ctx)
                                            killCount.set(killCount.value + 1, ctx)
                                            if (xp.value >= level.value * 100) {
                                                level.set(level.value + 1, ctx)
                                                maxHp.set(maxHp.value + 10, ctx)
                                            }
                                            enemyHp.set(100, ctx)
                                            inCombat.set(false, ctx)
                                            combatRounds.set(0, ctx)
                                            return NodeResult.Succeeded
                                        },
                                    }),
                                ]),
                            ]),
                            sequence({ name: 'FleeFromEnemy', activity: 'Fleeing' }, [
                                action({
                                    name: 'TurnAndRun',
                                    execute: (ctx) => {
                                        isFleeing.set(true, ctx)
                                        inCombat.set(false, ctx)
                                        currentActivity.set('fleeing', ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                                asyncAction({
                                    name: 'SprintToBase',
                                    activity: 'Sprinting',
                                    execute: async (ctx, signal) => {
                                        while (dist(posX.value, posY.value, 0, 0) > 5) {
                                            if (signal.aborted) return NodeResult.Failed
                                            const p = stepToward(posX.value, posY.value, 0, 0, moveSpeed.value * 2)
                                            posX.set(p.x, ctx)
                                            posY.set(p.y, ctx)
                                            stamina.set(Math.max(0, stamina.value - 0.5), ctx)
                                            await new Promise(r => setTimeout(r, 30))
                                        }
                                        return NodeResult.Succeeded
                                    },
                                }),
                                action({
                                    name: 'CatchBreath',
                                    execute: (ctx) => {
                                        isFleeing.set(false, ctx)
                                        currentActivity.set('idle', ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                                sleep({ name: 'FleeRecovery', duration: 80 }),
                            ]),
                        ]),
                    ])
                ),

                // ================================================================
                // 4. ITEM QUESTS
                // ================================================================
                subTree({ name: 'ItemQuests', namespace: 'questing', id: 'questing' },
                    selector({ name: 'QuestSelector', tag: 'questing',
                        precondition: { name: 'NotBusy', condition: () => !inCombat.value && !isFleeing.value },
                    }, [
                        sequence({ name: 'DeliverItems',
                            precondition: { name: 'HasEnoughItems', condition: () => inventory.value.filter(v => v !== 'potion').length >= 3 },
                        }, [
                            asyncAction({
                                name: 'ReturnToVillage',
                                activity: 'Returning',
                                execute: async (ctx, signal) => {
                                    while (dist(posX.value, posY.value, 0, 0) > 2) {
                                        if (signal.aborted) return NodeResult.Failed
                                        const p = stepToward(posX.value, posY.value, 0, 0, moveSpeed.value)
                                        posX.set(p.x, ctx)
                                        posY.set(p.y, ctx)
                                        await new Promise(r => setTimeout(r, 40))
                                    }
                                    return NodeResult.Succeeded
                                },
                            }),
                            action({
                                name: 'DepositItems',
                                execute: (ctx) => {
                                    const items_ = inventory.value.filter(v => v !== 'potion')
                                    gold.set(gold.value + items_.length * 3, ctx)
                                    inventory.set(inventory.value.filter(v => v === 'potion'), ctx)
                                    itemsDelivered.set(itemsDelivered.value + items_.length, ctx)
                                    carryingItems.set(0, ctx)
                                    return NodeResult.Succeeded
                                },
                            }),
                            displayState({
                                name: 'DeliveryReceipt',
                                display: () => ({
                                    delivered: itemsDelivered.value,
                                    goldEarned: gold.value,
                                }),
                                inputs: [itemsDelivered, gold],
                            }),
                        ]),
                        sequenceWithMemory({ name: 'CollectItem', timeout: 600 }, [
                            action({
                                name: 'FindNearestItem',
                                execute: (ctx) => {
                                    const available = items.value.filter(i => !i.collected)
                                    if (available.length === 0) return NodeResult.Failed
                                    let nearest = available[0] as (typeof available)[number]
                                    let nearestDist = dist(posX.value, posY.value, nearest.x, nearest.y)
                                    for (const item of available) {
                                        const d = dist(posX.value, posY.value, item.x, item.y)
                                        if (d < nearestDist) { nearestDist = d; nearest = item }
                                    }
                                    targetItemId.set(nearest.id, ctx)
                                    return NodeResult.Succeeded
                                },
                            }),
                            asyncAction({
                                name: 'NavigateToItem',
                                activity: 'Foraging',
                                execute: async (ctx, signal) => {
                                    const target = items.value.find(i => i.id === targetItemId.value)
                                    if (!target) return NodeResult.Failed
                                    while (dist(posX.value, posY.value, target.x, target.y) > 1.5) {
                                        if (signal.aborted) return NodeResult.Failed
                                        const p = stepToward(posX.value, posY.value, target.x, target.y, moveSpeed.value)
                                        posX.set(p.x, ctx)
                                        posY.set(p.y, ctx)
                                        await new Promise(r => setTimeout(r, 40))
                                    }
                                    return NodeResult.Succeeded
                                },
                            }),
                            action({
                                name: 'PickUpItem',
                                execute: (ctx) => {
                                    const idx = items.value.findIndex(i => i.id === targetItemId.value)
                                    if (idx < 0) return NodeResult.Failed
                                    const updated = items.value.map((i, j) => j === idx ? { ...i, collected: true } : i)
                                    items.set(updated, ctx)
                                    inventory.set([...inventory.value, (updated[idx] as (typeof updated)[number]).type], ctx)
                                    carryingItems.set(carryingItems.value + 1, ctx)
                                    targetItemId.set(-1, ctx)
                                    return NodeResult.Succeeded
                                },
                            }),
                        ]),
                    ])
                ),

                // ================================================================
                // 5. PATROL AND EXPLORE
                // ================================================================
                subTree({ name: 'PatrolAndExplore', namespace: 'patrol', id: 'patrol' },
                    sequence({
                        name: 'PatrolGate',
                        tag: 'patrol',
                        precondition: { name: 'CanPatrol', condition: () => !inCombat.value && !isFleeing.value && stamina.value > 10 },
                    }, [
                        utilitySequence({ name: 'PatrolActivities' }, [
                            utility({ scorer: () => alertLevel.value + (weather.value === 'storm' ? 20 : 0) },
                                sequence({ name: 'ScanArea' }, [
                                    action({ name: 'LookAround', execute: (ctx) => {
                                        heading.set((heading.value + 45) % 360, ctx)
                                        return NodeResult.Succeeded
                                    }, repeat: 4, delay: 10 }),
                                    action({ name: 'UpdateAlertLevel', execute: (ctx) => {
                                        const bonus = timeOfDay.value > 60 ? 10 : 0
                                        const stormBonus = weather.value === 'storm' ? 15 : 0
                                        alertLevel.set(Math.max(0, alertLevel.value - 5 + bonus + stormBonus), ctx)
                                        return NodeResult.Succeeded
                                    } }),
                                ])
                            ),
                            utility({ scorer: () => 50 },
                                sequenceWithMemory({ name: 'WaypointPatrol' }, [
                                    action({ name: 'SelectNextWaypoint', execute: (ctx) => {
                                        const next = waypointIndex.value + patrolDirection.value
                                        if (next >= WAYPOINTS.length || next < 0) {
                                            patrolDirection.set(-patrolDirection.value, ctx)
                                        }
                                        waypointIndex.set(Math.max(0, Math.min(WAYPOINTS.length - 1, next)), ctx)
                                        atWaypoint.set(false, ctx)
                                        currentActivity.set(`heading to ${(WAYPOINTS[waypointIndex.value % WAYPOINTS.length] as (typeof WAYPOINTS)[number]).name}`, ctx)
                                        return NodeResult.Succeeded
                                    } }),
                                    asyncAction({ name: 'MoveToWaypoint', activity: 'Patrolling',
                                        execute: async (ctx, signal) => {
                                            const wp = (WAYPOINTS[waypointIndex.value % WAYPOINTS.length] as (typeof WAYPOINTS)[number])
                                            while (dist(posX.value, posY.value, wp.x, wp.y) > 1.5) {
                                                if (signal.aborted) return NodeResult.Failed
                                                const p = stepToward(posX.value, posY.value, wp.x, wp.y, moveSpeed.value)
                                                posX.set(p.x, ctx)
                                                posY.set(p.y, ctx)
                                                stamina.set(Math.max(0, stamina.value - 0.05), ctx)
                                                await new Promise(r => setTimeout(r, 40))
                                            }
                                            atWaypoint.set(true, ctx)
                                            return NodeResult.Succeeded
                                        },
                                    }),
                                    sleep({ name: 'WaypointRest', duration: 60 }),
                                    action({ name: 'AdvanceWaypointIndex', execute: (ctx) => {
                                        waypointsVisited.set(waypointsVisited.value + 1, ctx)
                                        currentActivity.set('patrol', ctx)
                                        return NodeResult.Succeeded
                                    } }),
                                ])
                            ),
                        ]),
                    ])
                ),

                // ================================================================
                // 6. TRADING
                // ================================================================
                subTree({ name: 'Trading', namespace: 'trading', id: 'trading' },
                    sequence({
                        name: 'TradingGate',
                        tag: 'trading',
                        precondition: { name: 'CanTrade', condition: () => !inCombat.value && gold.value >= 8 && !inventory.value.includes('potion') },
                        throttle: 200,
                    }, [
                        asyncAction({
                            name: 'TravelToMerchant',
                            activity: 'Travelling',
                            execute: async (ctx, signal) => {
                                while (dist(posX.value, posY.value, MERCHANT_X, MERCHANT_Y) > 2) {
                                    if (signal.aborted) return NodeResult.Failed
                                    const p = stepToward(posX.value, posY.value, MERCHANT_X, MERCHANT_Y, moveSpeed.value)
                                    posX.set(p.x, ctx)
                                    posY.set(p.y, ctx)
                                    await new Promise(r => setTimeout(r, 40))
                                }
                                return NodeResult.Succeeded
                            },
                        }),
                        selectorWithMemory({ name: 'PurchaseSelector' }, [
                            sequence({ name: 'BuyPotion' }, [
                                condition({ name: 'AffordPotion', eval: () => gold.value >= 10 }),
                                action({
                                    name: 'PurchasePotion',
                                    execute: (ctx) => {
                                        gold.set(gold.value - 10, ctx)
                                        inventory.set([...inventory.value, 'potion'], ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                            ]),
                            sequence({ name: 'BuyScroll' }, [
                                condition({ name: 'AffordScroll', eval: () => gold.value >= 8 }),
                                action({
                                    name: 'PurchaseScroll',
                                    execute: (ctx) => {
                                        gold.set(gold.value - 8, ctx)
                                        inventory.set([...inventory.value, 'scroll'], ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                            ]),
                        ]),
                    ])
                ),

                // ================================================================
                // 7. NIGHTTIME BEHAVIOR
                // ================================================================
                subTree({ name: 'NighttimeBehavior', namespace: 'night', id: 'nighttime' },
                    sequence({
                        name: 'NightGate',
                        tag: 'nighttime',
                        precondition: { name: 'IsNight', condition: () => timeOfDay.value >= 60 && timeOfDay.value < 95 },
                    }, [
                        ifThenElse({ name: 'NightDecision' }, [
                            condition({ name: 'NearSafeZone', eval: () => isNearBase.value }),
                            sequence({ name: 'CampForNight' }, [
                                action({
                                    name: 'SetupCamp',
                                    execute: (ctx) => { currentActivity.set('camping', ctx); isResting.set(true, ctx); return NodeResult.Succeeded },
                                }),
                                sleep({ name: 'NightSleep', duration: 120 }),
                                action({
                                    name: 'WakeUp',
                                    execute: (ctx) => {
                                        hp.set(Math.min(maxHp.value, hp.value + 20), ctx)
                                        stamina.set(Math.min(100, stamina.value + 30), ctx)
                                        hunger.set(Math.min(100, hunger.value + 10), ctx)
                                        isResting.set(false, ctx)
                                        currentActivity.set('patrol', ctx)
                                        return NodeResult.Succeeded
                                    },
                                }),
                            ]),
                            asyncAction({
                                name: 'RushToSafety',
                                activity: 'Rushing',
                                execute: async (ctx, signal) => {
                                    while (dist(posX.value, posY.value, 0, 0) > 5) {
                                        if (signal.aborted) return NodeResult.Failed
                                        const p = stepToward(posX.value, posY.value, 0, 0, moveSpeed.value * 1.8)
                                        posX.set(p.x, ctx)
                                        posY.set(p.y, ctx)
                                        await new Promise(r => setTimeout(r, 35))
                                    }
                                    return NodeResult.Succeeded
                                },
                            }),
                        ]),
                    ])
                ),

                // ================================================================
                // 8. DIAGNOSTICS & HUDs
                // ================================================================
                subTree({ name: 'Diagnostics', namespace: 'diagnostics', id: 'diagnostics' },
                    parallel({
                        name: 'DiagnosticsParallel',
                        tag: 'diagnostics',
                        policy: () => NodeResult.Running,
                    }, [
                        displayState({
                            name: 'VitalsHUD',
                            display: () => ({
                                hp: `${hp.value.toFixed(1)}/${maxHp.value}`,
                                stamina: stamina.value.toFixed(1),
                                mana: mana.value.toFixed(1),
                                hunger: hunger.value.toFixed(1),
                                healing: isHealing.value,
                                resting: isResting.value,
                            }),
                            inputs: [hp, stamina, mana, hunger],
                            forceSuccess: true,
                        }),
                        displayState({
                            name: 'PositionHUD',
                            display: () => ({
                                pos: `(${posX.value.toFixed(1)}, ${posY.value.toFixed(1)})`,
                                heading: `${heading.value}°`,
                                speed: moveSpeed.value.toFixed(1),
                                atWaypoint: atWaypoint.value,
                                waypoint: (WAYPOINTS[waypointIndex.value % WAYPOINTS.length] as (typeof WAYPOINTS)[number]).name,
                                visited: waypointsVisited.value,
                            }),
                            inputs: [posX, posY, heading, waypointIndex],
                            forceSuccess: true,
                        }),
                        displayState({
                            name: 'CombatHUD',
                            display: () => ({
                                inCombat: inCombat.value,
                                fleeing: isFleeing.value,
                                rounds: combatRounds.value,
                                dealt: damageDealt.value,
                                taken: damageTaken.value,
                                kills: killCount.value,
                                enemyHp: enemyHp.value.toFixed(0),
                                enemyType: enemyType.value,
                            }),
                            inputs: [inCombat, isFleeing, combatRounds, killCount],
                            forceSuccess: true,
                        }),
                        displayState({
                            name: 'InventoryHUD',
                            display: () => ({
                                inventory: inventory.value.join(', ') || '—',
                                carrying: carryingItems.value,
                                delivered: itemsDelivered.value,
                                gold: gold.value,
                                level: level.value,
                                xp: xp.value,
                            }),
                            inputs: [inventory, gold, level, xp],
                            forceSuccess: true,
                        }),
                        displayState({
                            name: 'WorldHUDMirror',
                            display: () => ({
                                time: `${timeOfDay.value.toFixed(0)}/100`,
                                weather: weather.value,
                                alert: alertLevel.value,
                                activity: currentActivity.value,
                                nearBase: isNearBase.value,
                            }),
                            inputs: [timeOfDay, weather, alertLevel, currentActivity],
                            forceSuccess: true,
                        }),
                        sequence({ name: 'DecoratorShowcase', runOnce: true }, [
                            alwaysSuccess({ name: 'BootComplete' }),
                        ]),
                        sequence({ name: 'InverterShowcase', inverter: true, delay: 60 }, [
                            alwaysFailure({
                                name: 'InvertedFailure',
                                succeedIf: { name: 'SkipSometimes', condition: () => (tickCount.value % 17) === 0 },
                            }),
                        ]),
                        sequence({
                            name: 'HeartbeatLoop',
                            runningIsSuccess: true,
                            forceSuccess: true,
                            keepRunningUntilFailure: true,
                        }, [
                            action({
                                name: 'HeartbeatPulse',
                                execute: () => (tickCount.value % 29) === 0 ? NodeResult.Failed : NodeResult.Succeeded,
                            }),
                        ]),
                        alwaysRunning({ name: 'AmbientPulse', activity: 'Idle' }),
                    ])
                ),
            ])
        )
    ).enableStateTrace().setProfilingTimeProvider(() => performance.now()).enableProfiling()
}
