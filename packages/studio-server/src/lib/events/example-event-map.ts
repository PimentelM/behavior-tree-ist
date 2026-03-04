import z from "zod";
import { makeEventSchemaFromMap, SchemaMapType } from "./utils";

export const SessionStarted = z.object({
    namespaceId: z.string(),
})
export type SessionStarted = z.infer<typeof SessionStarted>

export const EnteredWorld = z.object({
    playerId: z.string(),
})
export type EnteredWorld = z.infer<typeof EnteredWorld>

export const PlayerEventMap = {
    SessionStarted,
    EnteredWorld,
}
export type PlayerEventMap = SchemaMapType<typeof PlayerEventMap>
export type PlayerEventName = keyof PlayerEventMap
export type PlayerEventBody = PlayerEventMap[PlayerEventName]
export const PlayerEvent = makeEventSchemaFromMap(PlayerEventMap);
export type PlayerEvent = z.infer<typeof PlayerEvent>;


export const ArenaChanged = z.object({
    newSceneHandle: z.string().nullable(),
    previousSceneHandle: z.string().nullable(),
})
export type ArenaChanged = z.infer<typeof ArenaChanged>

export const ArenaEventMap = {
    ArenaChanged,
}
export type ArenaEventMap = SchemaMapType<typeof ArenaEventMap>
export type ArenaEventName = keyof ArenaEventMap
export type ArenaEventBody = ArenaEventMap[ArenaEventName]
export const ArenaEvent = makeEventSchemaFromMap(ArenaEventMap);
export type ArenaEvent = z.infer<typeof ArenaEvent>;

export const GameEventMap = {
    ...PlayerEventMap,
    ...ArenaEventMap,
}
export type GameEventMap = SchemaMapType<typeof GameEventMap>
export type GameEventName = keyof GameEventMap;
export type GameEventBody = GameEventMap[GameEventName];
export const GameEvent = makeEventSchemaFromMap(GameEventMap);
export type GameEvent = z.infer<typeof GameEvent>;

export type DispatchedEvent =
    {
        subject: 'player';
        event: PlayerEvent;
    }
    |
    {
        subject: 'arena',
        event: ArenaEvent;
    }

export type EventSubject = DispatchedEvent['subject'];