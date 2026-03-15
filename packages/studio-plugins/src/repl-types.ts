/**
 * REPL plugin types — imports plugin interfaces from core and adds REPL-specific types.
 */
export type { StudioPlugin, PluginSender } from '@bt-studio/core';

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
