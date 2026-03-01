import { AGENT_PROTOCOL_VERSION, type AgentProtocolFrame, type AgentRequestMethod, type AgentEventName } from "./protocol";

const REQUEST_METHODS: readonly AgentRequestMethod[] = [
    "agent.listTrees",
    "agent.getTree",
    "agent.setCapture",
    "agent.restoreBaseline",
    "agent.setStreaming",
    "agent.ping",
];

const EVENT_NAMES: readonly AgentEventName[] = [
    "agent.hello",
    "agent.treesChanged",
    "agent.treeUpdated",
    "agent.tickBatch",
    "agent.heartbeat",
    "agent.warning",
];

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function decodeBytes(payload: Uint8Array): string {
    const g = globalThis as unknown as {
        TextDecoder?: new () => { decode(input: Uint8Array): string };
    };
    if (g.TextDecoder) {
        return new g.TextDecoder().decode(payload);
    }

    let text = "";
    for (let i = 0; i < payload.length; i++) {
        text += String.fromCharCode(payload[i]);
    }
    return text;
}

export function isAgentProtocolFrame(value: unknown): value is AgentProtocolFrame {
    if (!isObject(value)) {
        return false;
    }

    if (value.v !== AGENT_PROTOCOL_VERSION || typeof value.kind !== "string") {
        return false;
    }

    if (value.kind === "req") {
        return typeof value.id === "string"
            && typeof value.method === "string"
            && REQUEST_METHODS.includes(value.method as AgentRequestMethod);
    }

    if (value.kind === "res") {
        if (typeof value.id !== "string" || typeof value.ok !== "boolean") {
            return false;
        }
        if (!value.ok) {
            if (!isObject(value.error)) {
                return false;
            }
            return typeof value.error.code === "string" && typeof value.error.message === "string";
        }
        return true;
    }

    if (value.kind === "evt") {
        return typeof value.event === "string"
            && EVENT_NAMES.includes(value.event as AgentEventName);
    }

    return false;
}

export function parseAgentProtocolFrame(payload: Uint8Array | string): AgentProtocolFrame | undefined {
    const text = typeof payload === "string" ? payload : decodeBytes(payload);

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return undefined;
    }

    if (!isAgentProtocolFrame(parsed)) {
        return undefined;
    }

    return parsed;
}

export function encodeAgentProtocolFrame(frame: AgentProtocolFrame): string {
    return JSON.stringify(frame);
}
