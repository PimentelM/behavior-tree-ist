/**
 * Pure crypto utilities for the REPL plugin — no external dependencies.
 * NaCl-based functions have moved to @bt-studio/studio-plugins.
 */

// ---------------------------------------------------------------------------
// Base64url helpers (no padding)
// ---------------------------------------------------------------------------

export function base64urlEncode(bytes: Uint8Array): string {
    const bin = Buffer.from(bytes).toString('base64');
    return bin.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64urlDecode(s: string): Uint8Array {
    const pad =
        s.length % 4 === 2 ? '==' :
        s.length % 4 === 3 ? '=' :
        s.length % 4 === 1 ? '===' : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------------
// Cross-runtime CSPRNG
// ---------------------------------------------------------------------------

export function getRandomBytes(length: number): Uint8Array {
    const g = (typeof globalThis !== 'undefined') ? (globalThis as Record<string, unknown>) : {};
    const webCrypto = g['crypto'] as { getRandomValues?: (buf: Uint8Array) => Uint8Array } | undefined;
    if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
        const out = new Uint8Array(length);
        webCrypto.getRandomValues(out);
        return out;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const nodeCrypto = typeof require !== 'undefined' ? require('crypto') as { randomBytes: (n: number) => Buffer } : null;
        if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
            return new Uint8Array(nodeCrypto.randomBytes(length));
        }
    } catch {
        // ignore
    }
    // Non-crypto fallback (last resort)
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
}

// ---------------------------------------------------------------------------
// JSON ↔ bytes helpers
// ---------------------------------------------------------------------------

export function jsonToBytes(obj: unknown): Uint8Array {
    return new Uint8Array(Buffer.from(JSON.stringify(obj), 'utf8'));
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function bytesToJson<T = unknown>(bytes: Uint8Array): T {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
}
