# REPL Encryption Architecture Audit

**Task:** behavior-tree-ist-ee34
**Date:** 2026-03-17
**Status:** Complete

---

## 1. Executive Summary

The REPL encryption is **NOT end-to-end** between UI and Agent. The server (`ReplBroker`) holds the private key, performs all encryption/decryption, and has full plaintext access to every eval command and result. The UI contains dead code for E2E encryption that is never invoked and is also schema-incompatible with the current tRPC endpoint.

---

## 2. Full Handshake & Message Flow

### 2.1 Handshake (Agent → Server)

**File:** `packages/studio-plugins/src/repl-plugin.ts` — `doHandshake()`

1. Agent generates an ephemeral NaCl box keypair (`generateEphemeralKeyPair()`)
2. Agent generates a random 32-byte `sessionSeed`
3. Agent seals `sessionSeed` using NaCl box to `config.serverPublicKey` (the server's public key) with the ephemeral secret key
4. Agent encodes result as `headerToken` (base64url of `[version(1) | ephemeralPub(32) | nonce(24) | ciphertext]`)
5. Agent sends `{ type: 'handshake', headerToken }` to server via plugin channel (correlationId = `'handshake'`)

**File:** `packages/studio-server/src/app/services/repl-broker.ts` — `handleHandshake()`

6. Server receives handshake, decodes headerToken
7. Server calls `openSessionSeed(...)` using `this.serverSecretKey` — **server decrypts the sessionSeed**
8. Server derives directional keys via HKDF-SHA256:
   - `c2s` = agent→server direction (key info `'c2s'`)
   - `s2c` = server→agent direction (key info `'s2c'`)
9. Server stores `{ c2s, s2c }` in `sessionKeys` map, keyed by `connectionId`

### 2.2 Eval Request (UI → Server → Agent)

**File:** `packages/studio-ui/src/repl/use-repl.ts` — `sendEval()`

1. UI has **no session keys** (see §4 — `establishSession` is never called)
2. UI sends **plaintext** eval via tRPC: `trpc.repl.eval.mutate({ clientId, sessionId, code })`

**File:** `packages/studio-server/src/app/handlers/trpc/repl.ts`

3. Server receives plaintext `code` from UI
4. Server looks up `connectionId` from `agentConnectionRegistry`
5. Server calls `replBroker.sendEval(connectionId, input.code)` — **server has plaintext eval command**

**File:** `packages/studio-server/src/app/services/repl-broker.ts` — `sendEval()`

6. Server encrypts eval command using `secretboxEncrypt(jsonToBytes({ type: 'eval', code }), keys.s2c)`
7. Server sends encrypted payload to agent as plugin message

### 2.3 Eval Response (Agent → Server → UI)

**File:** `packages/studio-plugins/src/repl-plugin.ts` — `handleInbound()` / `handleEval()`

1. Agent decrypts inbound message using `sessionKeys.s2c` (server→agent key)
2. Agent evaluates JavaScript, captures console output
3. Agent encrypts result using `secretboxEncrypt(..., sessionKeys.c2s)` (agent→server key)
4. Agent sends encrypted response back

**File:** `packages/studio-server/src/app/services/repl-broker.ts` — `decryptResponse()`

5. Server decrypts agent response using `keys.c2s` — **server has plaintext result**
6. Server resolves the pending tRPC promise with plaintext `ReplEvalResult`

**File:** `packages/studio-ui/src/repl/use-repl.ts`

7. UI receives **plaintext** `ReplEvalResult` from tRPC response

---

## 3. Key Ownership

| Party | Key Held | Source |
|-------|----------|--------|
| Agent | Knows `config.serverPublicKey` (encrypts TO) | Provided at ReplPlugin construction |
| Server (ReplBroker) | Holds `serverSecretKey` (decrypts FROM agent) | Provided at ReplBroker construction |
| UI | Holds `DEMO_PRIVATE_KEY` in localStorage | Hardcoded seed or generated |

**Critical observation:** In the current implementation the server holds the private key matching the public key the agent encrypts to. The server is the cryptographic endpoint, not a relay.

**Demo mode:** `DEMO_SERVER_KEYPAIR` (from `studio-plugins/src/repl-crypto.ts`) is used for both the agent's `serverPublicKey` and the server's `serverSecretKey`. The `DEMO_PRIVATE_KEY` in `use-repl.ts` uses the identical 32-byte seed — meaning UI, server, and agent all share the same keypair in demo mode.

---

## 4. UI Encryption Code — Dead / Disconnected

`use-repl.ts` contains a complete E2E encryption implementation that is **never invoked**:

### 4a. `establishSession()` is never called

`ReplTerminal.tsx` calls `useRepl()` but never calls `repl.establishSession(headerToken)`. The `ready` flag (`sessionKeys !== null`) is permanently `false`, so all evals fall through to the plaintext tRPC path.

### 4b. tRPC schema mismatch

When `sessionKeys` are present, `use-repl.ts` would send:
```ts
trpc.repl.eval.mutate({ clientId, sessionId, encryptedPayload })
```

But the tRPC router (`packages/studio-server/src/app/handlers/trpc/repl.ts`) only accepts:
```ts
z.object({ clientId: z.string(), sessionId: z.string(), code: z.string() })
```

There is no `encryptedPayload` field. Even if `establishSession` were wired up, the encrypted path would fail Zod validation.

### 4c. openHandshake in use-repl.ts

The UI's `openHandshake()` decrypts a `headerToken` using the UI's own `secretKey`. This implies a design where the agent encrypts TO the UI's keypair (not the server's). But in the current implementation:
- The agent encrypts to `DEMO_SERVER_KEYPAIR.publicKey` (= the server's key)
- The UI's `openHandshake` would need the server's secret key to succeed
- In demo mode this works accidentally (same seed), but in production it would fail unless the UI holds the server's private key

---

## 5. Where Encryption/Decryption Happens at Each Hop

```
UI (plaintext)
  │
  │ tRPC HTTP (plaintext code/result)
  ▼
Server ReplBroker (has plaintext at all times)
  │
  │ NaCl secretbox encrypted (s2c key)
  ▼
Agent ReplPlugin (decrypts, evals, re-encrypts response)
  │
  │ NaCl secretbox encrypted (c2s key)
  ▼
Server ReplBroker (decrypts to plaintext)
  │
  │ tRPC HTTP (plaintext result)
  ▼
UI (receives plaintext)
```

**The server sees plaintext at both entry and exit.** The NaCl encryption only protects the Server↔Agent leg, not the UI↔Server leg.

---

## 6. Is the UI Encryption Redundant?

Yes and no. The UI encryption code in `use-repl.ts` is not currently redundant — it is simply **never invoked**. If it were wired up:
- It would encrypt the eval command before sending to the server
- The server would need to relay the ciphertext rather than decrypt it
- The agent would need to decrypt using the UI's public key (not the server's)

This would require a fundamentally different key exchange: agent encrypts TO the UI's NaCl public key, and the server relays without decrypting.

---

## 7. Original Design Intent Analysis

Evidence suggests two phases of design:

**Phase 1 (intended E2E, partial implementation):**
- `repl-crypto.ts` comments: *"c2s — client (agent) → server (UI) direction"* — "server" = UI
- `use-repl.ts` has full encryption machinery (deriveDirectionalKeys, openHandshake, encrypt/decrypt)
- The UI's `openHandshake` implies the agent should encrypt to the UI's keypair
- This would make the BT Studio server a blind relay

**Phase 2 (current implementation, server-mediated):**
- `ReplBroker` holds `serverSecretKey` and decrypts the agent handshake
- Server derives session keys and handles all crypto
- tRPC endpoint accepts plaintext `code`
- E2E crypto machinery in UI left in place but not wired

The naming in `repl-crypto.ts` (`c2s — client (agent) → server (UI)`) strongly implies the original intent was E2E with the server as blind relay, but the implementation pivoted to server-mediated encryption without removing the UI crypto code or updating the comments.

---

## 8. Open Questions for Owner

1. **What is the desired security model?**
   - (a) **Server-mediated** (current): Server decrypts all eval traffic. Simpler, but server has plaintext access. Acceptable if server is trusted (self-hosted).
   - (b) **E2E** (intended per code comments): Agent encrypts to UI's public key; server relays blindly. Server cannot read eval commands or results.

2. **If E2E is desired, what is the key exchange flow?**
   - Should the agent receive the UI's public key at connection time?
   - How does the agent verify the UI's public key is authentic (no MITM via the server)?
   - Should the UI's public key be registered on the server and forwarded to agents on connect?

3. **Where should `establishSession()` be called?**
   - The server would need to forward the headerToken to the UI after receiving it from the agent
   - This requires a new server→UI notification pathway (e.g., tRPC subscription or additional tRPC query)

4. **Should the tRPC endpoint accept `encryptedPayload` instead of `code`?**
   - If E2E, the server would relay the ciphertext without decrypting
   - The response path would similarly be opaque to the server

5. **Is `DEMO_SERVER_KEYPAIR.secretKey` intentionally exposed to the server, or should UI and server have separate keypairs in production?**
   - Currently the same seed is used for both, making the "server key" and "UI key" identical
   - In a true E2E design these must be different keys held by different parties

6. **Is server-mediated encryption acceptable for the initial release / demo mode?**
   - Many self-hosted dev tools accept server trust (e.g., localhost server)
   - The threat model may not require E2E if users run the server themselves

7. **Should the dead UI crypto code be removed or completed?**
   - If server-mediated: remove `openHandshake`, `establishSession`, encrypted tRPC paths, and directional key derivation from `use-repl.ts`
   - If E2E: complete the wiring — server forwards headerToken to UI, UI calls `establishSession`, tRPC endpoint accepts `encryptedPayload`

---

## 9. Files Audited

| File | Role |
|------|------|
| `packages/studio-plugins/src/repl-plugin.ts` | Agent-side: handshake initiation, decrypt inbound, encrypt outbound |
| `packages/studio-plugins/src/repl-crypto.ts` | Shared crypto primitives: NaCl box/secretbox, HKDF, header token encode/decode |
| `packages/studio-server/src/app/services/repl-broker.ts` | Server: handshake receipt, session key storage, eval/completions relay |
| `packages/studio-server/src/app/handlers/trpc/repl.ts` | Server: tRPC endpoint — accepts plaintext `code`, no `encryptedPayload` support |
| `packages/studio-ui/src/repl/use-repl.ts` | UI: key management, dead E2E encryption code, plaintext tRPC calls |
| `packages/studio-ui/src/repl/ReplTerminal.tsx` | UI: never calls `establishSession`, `ready` always false |
| `packages/studio-server/src/index.ts` | Server startup: `serverSecretKey: DEMO_SERVER_KEYPAIR.secretKey` |
| `packages/cli/src/demo-agent.ts` | Demo agent: `serverPublicKey: DEMO_SERVER_KEYPAIR.publicKey` |
