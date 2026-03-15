/**
 * Plugin system interfaces — defined here for use before Phase 1 (protocol/interfaces.ts)
 * wires them into StudioAgent. The lead agent (builder-plugin-protocol) will re-export
 * these from interfaces.ts so the rest of the system can import from one canonical location.
 */

export interface StudioPlugin {
    readonly pluginId: string;
    /** Called when the agent receives a PluginMessage addressed to this plugin. */
    handleInbound(correlationId: string, payload: unknown): Promise<void> | void;
    /** Called once so the plugin can send outbound messages via the agent. */
    attach(send: PluginSender): void;
    detach(): void;
}

export interface PluginSender {
    send(correlationId: string, payload: unknown): void;
}

// ---------------------------------------------------------------------------
// REPL action payloads (UI → Agent, decrypted)
// ---------------------------------------------------------------------------

export interface ReplEvalAction {
    type: 'eval';
    code: string;
}

export interface ReplCompletionsAction {
    type: 'completions';
    prefix: string;
    maxResults?: number;
}

export type ReplAction = ReplEvalAction | ReplCompletionsAction;

// ---------------------------------------------------------------------------
// REPL response payloads (Agent → UI, encrypted)
// ---------------------------------------------------------------------------

export interface ReplOutputPayload {
    type: 'result' | 'error';
    kind: 'result' | 'error';
    text: string;
    consoleOutput?: string[];
}

export interface ReplCompletionsPayload {
    type: 'completions';
    completions: string[];
}

/** Sent as the first PluginMessage from the agent after attach(). */
export interface ReplHandshakePayload {
    type: 'handshake';
    headerToken: string;
}

export type ReplOutboundPayload = ReplHandshakePayload | ReplOutputPayload | ReplCompletionsPayload;

// ---------------------------------------------------------------------------
// ReplPlugin config
// ---------------------------------------------------------------------------

export interface ReplPluginConfig {
    /** UI's static NaCl box public key (32 bytes). Used to seal the session seed. */
    serverPublicKey: Uint8Array;
}
