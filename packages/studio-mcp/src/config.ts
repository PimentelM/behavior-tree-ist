import { base64urlDecode, DEMO_UI_KEYPAIR } from '@bt-studio/studio-plugins';

export interface McpConfig {
    serverUrl: string;
    privateKey: Uint8Array;
    evalTimeoutMs: number;
    completionsTimeoutMs: number;
}

function parsePrivateKey(raw: string): Uint8Array {
    // Accept 64-char hex (32 bytes) or 43-char base64url (32 bytes)
    if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }

    // base64url: try decode and validate length
    try {
        const bytes = base64urlDecode(raw);
        if (bytes.length !== 32) {
            throw new Error(`Expected 32 bytes, got ${bytes.length}`);
        }
        return bytes;
    } catch {
        throw new Error(
            'BT_STUDIO_PRIVATE_KEY must be a 64-char hex string or 43-char base64url string representing 32 bytes',
        );
    }
}

export function loadConfig(): McpConfig {
    const serverUrl = process.env['BT_STUDIO_URL'];
    if (!serverUrl) {
        throw new Error('BT_STUDIO_URL environment variable is required');
    }

    const rawKey = process.env['BT_STUDIO_PRIVATE_KEY'];
    let privateKey: Uint8Array;
    if (!rawKey) {
        // Fall back to demo keypair — useful for local development with demo agents
        process.stderr.write(
            '[bt-studio-mcp] WARNING: BT_STUDIO_PRIVATE_KEY not set, using demo keypair. ' +
                'Agents must be configured with DEMO_UI_KEYPAIR.publicKey.\n',
        );
        privateKey = DEMO_UI_KEYPAIR.secretKey;
    } else {
        privateKey = parsePrivateKey(rawKey);
    }

    const evalTimeoutMs = parseInt(process.env['BT_STUDIO_EVAL_TIMEOUT_MS'] ?? '15000', 10);
    const completionsTimeoutMs = parseInt(process.env['BT_STUDIO_COMPLETIONS_TIMEOUT_MS'] ?? '5000', 10);

    return { serverUrl, privateKey, evalTimeoutMs, completionsTimeoutMs };
}
