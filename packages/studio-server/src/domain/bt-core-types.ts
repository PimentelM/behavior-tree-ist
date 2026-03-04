import {
    CommandResponse,
    InboundMessage,
    MessageType,
    NodeResult,
    OutboundMessage,
    RefChangeEvent,
    SerializableMetadata,
    SerializableNode,
    SerializableValue,
    StudioCommand,
    StudioCommandType,
    StudioErrorCode,
    TickRecord,
    TickTraceEvent,
    TreeStatuses,
} from '@behavior-tree-ist/core';
import { z } from 'zod';

export const MessageTypeSchema = z.union([
    z.literal(MessageType.Hello),
    z.literal(MessageType.TreeRegistered),
    z.literal(MessageType.TreeRemoved),
    z.literal(MessageType.TickBatch),
    z.literal(MessageType.CommandResponse),
    z.literal(MessageType.Command),
]);

export const StudioCommandTypeSchema = z.union([
    z.literal(StudioCommandType.EnableStreaming),
    z.literal(StudioCommandType.DisableStreaming),
    z.literal(StudioCommandType.EnableStateTrace),
    z.literal(StudioCommandType.DisableStateTrace),
    z.literal(StudioCommandType.EnableProfiling),
    z.literal(StudioCommandType.DisableProfiling),
    z.literal(StudioCommandType.GetTreeStatuses),
]);

export const StudioErrorCodeSchema = z.union([
    z.literal(StudioErrorCode.TreeNotFound),
    z.literal(StudioErrorCode.UnknownCommand),
]);

export const SerializableValueSchema: z.ZodType<SerializableValue> = z.lazy(() => z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
    z.array(SerializableValueSchema),
    z.record(SerializableValueSchema),
]));

export const SerializableMetadataSchema: z.ZodType<SerializableMetadata> = z
    .record(SerializableValueSchema)
    .readonly();

export const TickTraceEventSchema: z.ZodType<TickTraceEvent> = z
    .object({
        nodeId: z.number().int(),
        result: z.union([
            z.literal(NodeResult.Succeeded),
            z.literal(NodeResult.Failed),
            z.literal(NodeResult.Running),
        ]),
        state: SerializableValueSchema.optional(),
        startedAt: z.number().optional(),
        finishedAt: z.number().optional(),
    })
    .strict();

export const RefChangeEventSchema: z.ZodType<RefChangeEvent, z.ZodTypeDef, unknown> = z
    .object({
        tickId: z.number().int(),
        timestamp: z.number(),
        refName: z.string().optional(),
        nodeId: z.number().int().optional(),
        newValue: z.unknown().optional(),
        isAsync: z.boolean(),
    })
    .strict()
    .transform((value): RefChangeEvent => ({
        tickId: value.tickId,
        timestamp: value.timestamp,
        refName: value.refName,
        nodeId: value.nodeId,
        newValue: value.newValue,
        isAsync: value.isAsync,
    }));

export const TickRecordSchema: z.ZodType<TickRecord, z.ZodTypeDef, unknown> = z
    .object({
        tickId: z.number().int(),
        timestamp: z.number(),
        events: z.array(TickTraceEventSchema),
        refEvents: z.array(RefChangeEventSchema),
    })
    .strict();

export const SerializableNodeSchema: z.ZodType<SerializableNode> = z.lazy(() => z
    .object({
        id: z.number().int(),
        nodeFlags: z.number().int(),
        defaultName: z.string(),
        name: z.string(),
        children: z.array(SerializableNodeSchema).optional(),
        state: SerializableValueSchema.optional(),
        metadata: SerializableMetadataSchema.optional(),
        tags: z.array(z.string()).readonly().optional(),
        activity: z.union([z.string(), z.literal(true)]).optional(),
    })
    .strict());

export const TreeStatusesSchema: z.ZodType<TreeStatuses> = z
    .object({
        streaming: z.boolean(),
        stateTrace: z.boolean(),
        profiling: z.boolean(),
    })
    .strict();

export const CommandResponseSchema: z.ZodType<CommandResponse> = z.union([
    z.object({ success: z.literal(true) }).strict(),
    z.object({ success: z.literal(true), data: TreeStatusesSchema }).strict(),
    z.object({
        success: z.literal(false),
        errorCode: StudioErrorCodeSchema,
        errorMessage: z.string(),
    }).strict(),
]);

export const StudioCommandSchema: z.ZodType<StudioCommand> = z
    .object({
        correlationId: z.string(),
        treeId: z.string(),
        command: StudioCommandTypeSchema,
    })
    .strict();

export const OutboundMessageSchema: z.ZodType<OutboundMessage, z.ZodTypeDef, unknown> = z.union([
    z
        .object({
            t: z.literal(MessageType.Hello),
            version: z.number(),
            clientId: z.string(),
            sessionId: z.string(),
        })
        .strict(),
    z
        .object({
            t: z.literal(MessageType.TreeRegistered),
            treeId: z.string(),
            serializedTree: SerializableNodeSchema,
        })
        .strict(),
    z
        .object({
            t: z.literal(MessageType.TreeRemoved),
            treeId: z.string(),
        })
        .strict(),
    z
        .object({
            t: z.literal(MessageType.TickBatch),
            treeId: z.string(),
            ticks: z.array(TickRecordSchema),
        })
        .strict(),
    z
        .object({
            t: z.literal(MessageType.CommandResponse),
            correlationId: z.string(),
            response: CommandResponseSchema,
        })
        .strict(),
]);

export const InboundMessageSchema: z.ZodType<InboundMessage, z.ZodTypeDef, unknown> = z
    .object({
        t: z.literal(MessageType.Command),
        command: StudioCommandSchema,
    })
    .strict();

type IsExact<A, B> =
    [A] extends [B]
    ? ([B] extends [A] ? true : false)
    : false;
type AssertTrue<T extends true> = T;

// Compile time validations that both types are in sync
type _MessageTypeExact = AssertTrue<IsExact<z.output<typeof MessageTypeSchema>, MessageType>>;
type _StudioCommandTypeExact = AssertTrue<IsExact<z.output<typeof StudioCommandTypeSchema>, StudioCommandType>>;
type _StudioErrorCodeExact = AssertTrue<IsExact<z.output<typeof StudioErrorCodeSchema>, StudioErrorCode>>;
type _SerializableValueExact = AssertTrue<IsExact<z.output<typeof SerializableValueSchema>, SerializableValue>>;
type _SerializableMetadataExact = AssertTrue<IsExact<z.output<typeof SerializableMetadataSchema>, SerializableMetadata>>;
type _TickTraceEventExact = AssertTrue<IsExact<z.output<typeof TickTraceEventSchema>, TickTraceEvent>>;
type _RefChangeEventExact = AssertTrue<IsExact<z.output<typeof RefChangeEventSchema>, RefChangeEvent>>;
type _TickRecordExact = AssertTrue<IsExact<z.output<typeof TickRecordSchema>, TickRecord>>;
type _SerializableNodeExact = AssertTrue<IsExact<z.output<typeof SerializableNodeSchema>, SerializableNode>>;
type _TreeStatusesExact = AssertTrue<IsExact<z.output<typeof TreeStatusesSchema>, TreeStatuses>>;
type _CommandResponseExact = AssertTrue<IsExact<z.output<typeof CommandResponseSchema>, CommandResponse>>;
type _StudioCommandExact = AssertTrue<IsExact<z.output<typeof StudioCommandSchema>, StudioCommand>>;
type _OutboundMessageExact = AssertTrue<IsExact<z.output<typeof OutboundMessageSchema>, OutboundMessage>>;
type _InboundMessageExact = AssertTrue<IsExact<z.output<typeof InboundMessageSchema>, InboundMessage>>;
