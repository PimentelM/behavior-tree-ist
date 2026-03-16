import z from "zod";


/**
 * Creates a Zod union schema from a map of event schemas that properly infers
 * discriminated union types based on the `name` field.
 * 
 * @example
 * const EventMap = {
 *   UserLogin: z.object({ userId: z.string() }),
 *   UserLogout: z.object({ reason: z.string() }),
 * } as const;
 * 
 * const Event = makeEventSchemaFromMap(EventMap);
 * type Event = z.infer<typeof Event>;
 * // Result: { name: "UserLogin"; body: { userId: string } } | { name: "UserLogout"; body: { reason: string } }
 */
export function makeEventSchemaFromMap<T extends Record<string, z.ZodTypeAny>>(
    map: T
): z.ZodType<{
    [K in keyof T]: {
        name: K;
        body: z.infer<T[K]>;
    };
}[keyof T]> {
    const keys = Object.keys(map);

    if (keys.length === 0) {
        throw new Error("Cannot create union from empty map");
    }

    const schemas = keys.map(key =>
        z.object({
            name: z.literal(key),
            body: map[key] as z.ZodTypeAny,
        })
    );

    // Handle single schema edge case
    if (schemas.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
        return z.union([schemas[0] as z.ZodTypeAny, schemas[0] as z.ZodTypeAny]) as any;
    }

    // Create union with proper typing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
    return z.discriminatedUnion("name", [schemas[0] as z.ZodDiscriminatedUnionOption<"name">, schemas[1] as z.ZodDiscriminatedUnionOption<"name">, ...schemas.slice(2) as z.ZodDiscriminatedUnionOption<"name">[]]) as any;
}

// Just an util to handle the EventMap object which references the schema objects
export type SchemaMapType<T extends Record<string, z.ZodTypeAny>> = {
    [K in keyof T]: z.infer<T[K]>;
};

