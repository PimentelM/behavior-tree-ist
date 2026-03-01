import { z } from 'zod';

const FrameBaseSchema = z.object({
  v: z.literal(1),
  kind: z.enum(['req', 'res', 'evt']),
});

const RequestFrameSchema = FrameBaseSchema.extend({
  kind: z.literal('req'),
  id: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown().optional(),
});

const SuccessResponseFrameSchema = FrameBaseSchema.extend({
  kind: z.literal('res'),
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown().optional(),
});

const ErrorResponseFrameSchema = FrameBaseSchema.extend({
  kind: z.literal('res'),
  id: z.string().min(1),
  ok: z.literal(false),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

const EventFrameSchema = FrameBaseSchema.extend({
  kind: z.literal('evt'),
  event: z.string().min(1),
  data: z.unknown().optional(),
});

export const AnyFrameSchema = z.union([
  RequestFrameSchema,
  SuccessResponseFrameSchema,
  ErrorResponseFrameSchema,
  EventFrameSchema,
]);

export type AnyFrame = z.infer<typeof AnyFrameSchema>;

const UiConfigureChannelParamsSchema = z.object({
  mode: z.enum(['listen', 'connect']),
  connect: z.object({
    url: z.string().min(1),
  }).optional(),
});

const UiSelectAgentParamsSchema = z.object({
  agentId: z.string().min(1),
});

const UiSelectTreeParamsSchema = z.object({
  treeKey: z.string().min(1),
});

const UiSetCaptureParamsSchema = z.object({
  scope: z.enum(['tree', 'all']),
  treeKey: z.string().min(1).optional(),
  traceState: z.boolean().optional(),
  profiling: z.boolean().optional(),
});

export const UiRequestSchema = z.union([
  RequestFrameSchema.extend({ method: z.literal('ui.getSessionState') }),
  RequestFrameSchema.extend({ method: z.literal('ui.heartbeat') }),
  RequestFrameSchema.extend({ method: z.literal('ui.detachAgent') }),
  RequestFrameSchema.extend({
    method: z.literal('ui.configureChannel'),
    params: UiConfigureChannelParamsSchema,
  }),
  RequestFrameSchema.extend({
    method: z.literal('ui.selectAgent'),
    params: UiSelectAgentParamsSchema,
  }),
  RequestFrameSchema.extend({
    method: z.literal('ui.selectTree'),
    params: UiSelectTreeParamsSchema,
  }),
  RequestFrameSchema.extend({
    method: z.literal('ui.setCapture'),
    params: UiSetCaptureParamsSchema,
  }),
]);

export type UiRequest = z.infer<typeof UiRequestSchema>;

const AgentTreeInfoSchema = z.object({
  treeKey: z.string().min(1),
  treeId: z.number(),
  name: z.string(),
  description: z.string().optional(),
});

const AgentHelloEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.hello'),
  data: z.object({
    clientName: z.string().min(1),
    protocolVersion: z.literal(1),
    trees: z.array(AgentTreeInfoSchema),
  }),
});

const AgentTreesChangedEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.treesChanged'),
  data: z.object({
    trees: z.array(AgentTreeInfoSchema),
  }),
});

const AgentTreeUpdatedEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.treeUpdated'),
  data: z.object({
    treeKey: z.string().min(1),
    tree: z.unknown(),
  }),
});

const AgentTickBatchEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.tickBatch'),
  data: z.object({
    treeKey: z.string().min(1),
    seq: z.number(),
    ticks: z.array(z.unknown()),
    droppedSinceLast: z.number().int().nonnegative(),
  }),
});

const AgentHeartbeatEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.heartbeat'),
  data: z.object({
    at: z.number(),
  }),
});

const AgentWarningEventSchema = EventFrameSchema.extend({
  event: z.literal('agent.warning'),
  data: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export const AgentEventSchema = z.union([
  AgentHelloEventSchema,
  AgentTreesChangedEventSchema,
  AgentTreeUpdatedEventSchema,
  AgentTickBatchEventSchema,
  AgentHeartbeatEventSchema,
  AgentWarningEventSchema,
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const AgentResponseSchema = z.union([
  SuccessResponseFrameSchema,
  ErrorResponseFrameSchema,
]);

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}
