# Security Audit: REPL E2E Encryption System

**Date:** 2026-03-17
**Scope:** Full REPL end-to-end encryption architecture
**Files reviewed:**
- `packages/studio-plugins/src/repl-crypto.ts` — crypto primitives
- `packages/studio-plugins/src/repl-plugin.ts` — agent-side handshake + per-message encryption
- `packages/studio-plugins/src/repl-client.ts` — UI-side ReplClient class
- `packages/studio-ui/src/repl/use-repl.ts` — browser key management + React hook
- `packages/studio-server/src/app/services/repl-broker.ts` — server blind relay
- `packages/studio-server/src/app/handlers/trpc/repl.ts` — tRPC endpoints
- All associated test files

## Executive Summary

The REPL E2E encryption system uses NaCl primitives (Curve25519 key exchange, XSalsa20-Poly1305 authenticated encryption) in a bespoke protocol. The cryptographic primitives are correctly applied and the server blind relay design achieves genuine end-to-end encryption. However, the protocol has several gaps compared to established patterns (Signal, Noise, TLS): no replay protection, no key ratcheting, no mutual authentication, and a hardcoded demo keypair used by default. Key storage in `localStorage` is vulnerable to XSS. A duplicate crypto implementation in `use-repl.ts` contains a base64url decoding bug and doubles the attack surface.

---

## Finding 1: No Replay Protection

**Severity: HIGH**
**Files:** `repl-crypto.ts`, `repl-broker.ts`, `repl-plugin.ts`

**Description:** There is no sequence numbering, timestamp validation, or nonce deduplication anywhere in the protocol. Each encrypted message contains a random nonce, but neither the agent nor the server tracks previously seen nonces.

**Impact:** An attacker who captures an encrypted eval message (e.g. via network interception or server logs) can replay it indefinitely. The server will relay it as a new request, and the agent will decrypt and execute it again. This is especially dangerous for `eval` messages — a replayed `process.exit()` or destructive command would execute repeatedly.

**Attack scenario:**
1. Attacker captures encrypted eval payload from network or server memory
2. Attacker sends the same `encryptedPayload` to `repl.eval.mutate` with valid `clientId`/`sessionId`
3. Server relays it; agent decrypts and executes the same code again

**Recommendation:**
- Add a monotonically increasing counter to each message (included in the authenticated plaintext)
- Agent rejects messages with counter <= last seen counter
- Alternatively, track a set of recently seen nonces and reject duplicates

---

## Finding 2: Demo Keypair Ships as Default

**Severity: HIGH**
**Files:** `repl-crypto.ts` (lines 211-221), `use-repl.ts` (lines 55-60)

**Description:** A hardcoded NaCl keypair derived from the ASCII seed `"bt-studio-demo-repl-key-v1------"` is used by default when no key is configured. The comment says "NEVER use in production" but there is no enforcement mechanism — no warning, no environment check, no refusal to operate.

**Impact:** Anyone with access to the source code (which is public) can:
- Decrypt ALL REPL traffic encrypted with the demo keypair
- Recover session seeds from captured headerTokens
- Forge eval commands to agents
- Read all eval responses

This effectively reduces security to plaintext for all deployments using the default configuration.

**Recommendation:**
- Log a prominent warning at startup when demo keys are detected
- Consider requiring explicit opt-in for demo keys (e.g. `--allow-demo-keys` flag)
- Provide a CLI command or UI flow for generating production keys
- Add a `NODE_ENV` check that refuses demo keys in production mode

---

## Finding 3: Private Key Stored in localStorage (XSS Exposure)

**Severity: HIGH**
**Files:** `use-repl.ts` (lines 64, 83-98, 104)

**Description:** The UI's long-term NaCl private key is stored in browser `localStorage` under the key `repl-private-key` as a raw base64url string. There is no encryption at rest, no access control, and no integrity protection.

**Impact:** Any XSS vulnerability in the application (or any browser extension with page access) gives an attacker the private key. With the private key, an attacker can:
- Decrypt all past sessions (if headerTokens were captured)
- Decrypt all future sessions
- Impersonate the UI to any agent

`localStorage` is accessible to all JavaScript on the same origin, making it a poor choice for long-lived secret keys.

**Recommendation:**
- Move key storage to the `SubtleCrypto` API with non-extractable keys (WebCrypto `CryptoKey` objects with `extractable: false`)
- If NaCl must be used (no WebCrypto equivalent for Curve25519), consider encrypting the key at rest with a user-provided password
- At minimum, use `sessionStorage` instead of `localStorage` to limit key lifetime to the browser tab
- Implement Content Security Policy (CSP) headers to mitigate XSS risk

---

## Finding 4: Limited Forward Secrecy

**Severity: MEDIUM**
**Files:** `repl-plugin.ts` (lines 272-292), `repl-client.ts` (lines 79-89)

**Description:** The agent generates an ephemeral keypair per session, providing forward secrecy from the agent's perspective. However, the UI uses a long-term static key. If the UI private key is compromised at any point, ALL past sessions can be decrypted — an attacker can recover the sessionSeed from any recorded headerToken.

Additionally, there is no key ratcheting within a session. The same `c2s` and `s2c` keys are used for every message in a session. Compromise of a session key exposes all messages in that session, past and future.

**Comparison:** Signal Protocol achieves post-compromise security via continuous Diffie-Hellman ratcheting. Noise Protocol's "XX" pattern provides mutual ephemeral key exchange.

**Recommendation:**
- Consider a double-sided ephemeral exchange (both agent and UI contribute ephemeral keys)
- For long sessions, implement symmetric key ratcheting (e.g. derive the next key from the current key + message hash)

---

## Finding 5: No Mutual Authentication

**Severity: MEDIUM**
**Files:** `repl-plugin.ts`, `repl-client.ts`

**Description:** The handshake is one-directional: the agent proves it knows who the UI is (by encrypting to the UI's public key), but the UI does not authenticate to the agent. The agent has no way to verify that the entity sending encrypted eval commands is the legitimate UI holder.

**Impact:** If an attacker obtains session keys (e.g. via XSS on the UI, or by compromising the server's relay), the agent will accept commands from anyone with valid session keys. There is no mechanism for the agent to challenge the sender.

**Recommendation:**
- For the current use case (local development tool), this is an acceptable trade-off
- For production deployment, consider adding a challenge-response step where the UI proves knowledge of its private key

---

## Finding 6: Duplicate Crypto Implementation in use-repl.ts

**Severity: MEDIUM**
**Files:** `use-repl.ts` (lines 9-49)

**Description:** `use-repl.ts` contains a complete reimplementation of crypto helpers (`base64urlEncode`, `base64urlDecode`, `jsonToBytes`, `bytesToJson`, `encodeEnvelope`, `decodeEnvelope`, `deriveDirectionalKeys`) instead of using the implementations from `repl-crypto.ts` or the `ReplClient` class from `repl-client.ts`.

This creates two problems:

1. **Bug:** The `base64urlDecode` in `use-repl.ts` handles `length % 4 === 1` by adding `'==='` padding, which is invalid base64. The canonical implementation in `repl-crypto.ts` correctly throws an error. This means `use-repl.ts` will silently produce garbage output for certain malformed inputs instead of rejecting them.

2. **Double attack surface:** Any crypto bug needs to be fixed in two places. The two implementations may diverge further over time.

**Recommendation:**
- Refactor `use-repl.ts` to use `ReplClient` from `repl-client.ts` for all crypto operations
- Remove the duplicate helper functions
- The `ReplClient` class was designed exactly for this purpose

---

## Finding 7: HKDF Empty Salt

**Severity: LOW**
**Files:** `repl-crypto.ts` (lines 137-142), `use-repl.ts` (lines 44-49)

**Description:** The HKDF key derivation uses an empty salt (`new Uint8Array(0)`). RFC 5869 recommends using a random salt for maximal security, as it provides an additional layer of key separation.

**Impact:** Since the input keying material (sessionSeed) is already 32 bytes of CSPRNG output, the empty salt does not create a practical vulnerability. HKDF with an empty salt is explicitly supported by the RFC and degrades to HMAC-based extraction with a zero-filled salt. However, the info strings (`"c2s"`, `"s2c"`) don't bind the derived keys to a specific session context (no participant identities, no session ID).

**Recommendation:**
- Optionally include a salt derived from the handshake transcript (e.g. hash of the headerToken)
- Extend the info string to include context binding: `"c2s|" + hex(agentEphemeralPub) + "|" + hex(uiPub)`

---

## Finding 8: HeaderToken Version Byte Not Authenticated

**Severity: LOW**
**Files:** `repl-crypto.ts` (lines 39-66)

**Description:** The headerToken format is `version (1 byte) | ephemeralPub (32 bytes) | nonce (24 bytes) | ciphertext`. The NaCl box authenticates the ciphertext, but the version byte and ephemeral public key sit outside the authenticated region.

**Impact:** In practice, tampering with the ephemeral public key causes decryption to fail (since the shared secret depends on it). Tampering with the version byte has no effect since it is currently unused. However, this is a structural weakness — if future versions add version-dependent behavior, an attacker could downgrade the version byte.

**Recommendation:**
- Include the version byte and ephemeral public key in the NaCl box's plaintext (alongside the sessionSeed), so they're covered by the authentication tag
- Alternatively, compute a MAC over the full token before encryption

---

## Finding 9: Server Can Reorder and Delay Messages

**Severity: LOW**
**Files:** `repl-broker.ts`

**Description:** The server blind relay does not enforce message ordering. It generates its own `correlationId` (UUID) for each relay call, which correlates requests to responses but provides no ordering guarantees. A compromised server could:
- Delay messages arbitrarily
- Reorder messages
- Selectively drop messages (DoS)

**Impact:** For a REPL use case, message reordering is unlikely to cause security issues (each eval is independent). Selective dropping is a DoS vector but does not compromise confidentiality or integrity.

**Recommendation:** Acceptable for the current use case. If ordering becomes important, add client-side sequence numbers.

---

## Finding 10: No Rate Limiting on tRPC Endpoints

**Severity: LOW**
**Files:** `repl.ts` (tRPC router)

**Description:** The tRPC endpoints (`repl.handshake`, `repl.eval`, `repl.completions`) perform no rate limiting. An attacker who can reach the server can flood the agent with eval requests, causing CPU exhaustion.

**Impact:** The agent has a 15-second eval timeout, which limits the damage per request. However, concurrent requests are not bounded — an attacker could open many parallel eval calls.

**Recommendation:**
- Add per-connection rate limiting on the server
- Consider a concurrent request limit per agent

---

## Finding 11: No Input Validation on encryptedPayload Size

**Severity: LOW**
**Files:** `repl.ts` (lines 33-37)

**Description:** The `encryptedPayload` field is validated only as `z.string()` with no length limit. An attacker could send extremely large strings, consuming server memory during relay.

**Recommendation:**
- Add `z.string().max(MAX_PAYLOAD_SIZE)` to the Zod schema
- A reasonable limit would be 1MB (base64url encoding of a large eval expression)

---

## Test Coverage Assessment

**Well tested:**
- Crypto primitive round-trips (base64url, secretbox, headerToken, HKDF)
- Handshake integration (agent + UI derive same keys)
- Tampered ciphertext rejection
- Wrong key rejection
- Pre-handshake error states
- Full eval/completions round-trips through ReplPlugin and ReplClient
- Server relay mechanics (ReplBroker)
- Timeout behavior
- Disconnected agent handling

**NOT tested:**
- Replay attacks (sending the same encrypted payload twice)
- Nonce uniqueness across messages
- Demo keypair detection/warning
- Key storage security (localStorage access patterns)
- Cross-session key isolation
- Large payload handling
- Concurrent request limits
- Version byte validation
- base64url edge cases in `use-repl.ts` (the buggy browser implementation)

---

## Protocol Diagram

```
Agent                           Server (ReplBroker)                    UI (Browser)
  |                                    |                                    |
  |-- [attach] ----------------------->|                                    |
  |   ephemeral = newKeyPair()         |                                    |
  |   seed = random(32)               |                                    |
  |   box = nacl.box(seed,            |                                    |
  |     nonce, uiPubKey, ephSk)       |                                    |
  |   headerToken = v|ephPub|nonce|box |                                    |
  |   send("handshake", {headerToken}) |                                    |
  |                                    |-- stores headerToken ------------->|
  |                                    |                                    |
  |                                    |<-- handshake.query({clientId}) ----|
  |                                    |-- returns {headerToken} ---------->|
  |                                    |                                    |
  |                                    |   seed = nacl.box.open(box,       |
  |                                    |     nonce, ephPub, uiSecretKey)   |
  |                                    |   c2s,s2c = HKDF(seed,"c2s/s2c") |
  |                                    |                                    |
  |   c2s,s2c = HKDF(seed,"c2s/s2c")  |                                    |
  |                                    |                                    |
  |                                    |<-- eval.mutate({encPayload}) ------|
  |                                    |     encrypted with s2c key         |
  |<-- relay(encPayload) -------------|                                    |
  |   decrypt with s2c key             |                                    |
  |   execute code                     |                                    |
  |   encrypt result with c2s key      |                                    |
  |-- response ----------------------->|                                    |
  |                                    |-- returns {encPayload} ---------->|
  |                                    |     decrypted with c2s key         |
```

---

## Summary Table

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | No replay protection | HIGH | Open |
| 2 | Demo keypair ships as default | HIGH | Open |
| 3 | Private key in localStorage (XSS) | HIGH | Open |
| 4 | Limited forward secrecy | MEDIUM | Open |
| 5 | No mutual authentication | MEDIUM | Acceptable for dev tool |
| 6 | Duplicate crypto in use-repl.ts (with bug) | MEDIUM | Open |
| 7 | HKDF empty salt | LOW | Acceptable |
| 8 | HeaderToken version byte not authenticated | LOW | Open |
| 9 | Server can reorder/delay messages | LOW | Acceptable |
| 10 | No rate limiting on tRPC endpoints | LOW | Open |
| 11 | No input validation on payload size | LOW | Open |

---

## Recommendations Priority

**Immediate (HIGH):**
1. Refactor `use-repl.ts` to use `ReplClient` — eliminates the duplicate code and base64url bug
2. Add replay protection (monotonic counter or nonce tracking)
3. Add a production key generation workflow and demo key warnings

**Short-term (MEDIUM):**
4. Evaluate moving key storage from `localStorage` to a more secure mechanism
5. Add payload size limits to tRPC schemas
6. Add rate limiting on eval/completions endpoints

**Long-term (LOW):**
7. Consider key ratcheting for long-lived sessions
8. Bind session context into HKDF info strings
9. Authenticate the full headerToken structure (not just the ciphertext)
