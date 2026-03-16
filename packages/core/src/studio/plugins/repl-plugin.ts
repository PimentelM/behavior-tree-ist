/**
 * Pure REPL utility functions — no external dependencies.
 * The full ReplPlugin class (with NaCl encryption) is in @bt-studio/studio-plugins.
 */

export function toDisplayString(value: unknown): string {
    try {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
        ) {
            return String(value);
        }
        if (typeof value === 'function') {
            const name = (value as { name?: string }).name || 'anonymous';
            return `[Function ${name}]`;
        }
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'object') {
            try {
                return JSON.stringify(
                    value,
                    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
                    2,
                );
            } catch {
                const ctor = (value as { constructor?: { name?: string } })?.constructor?.name ?? 'Object';
                const keys = Object.keys(value).slice(0, 20);
                return `[${ctor} { ${keys.join(', ')}${keys.length >= 20 ? ', ...' : ''} }]`;
            }
        }
    } catch (err) {
        return `[[toString error]] ${err}`;
    }
    return String(value);
}

export function getPropertyNamesDeep(target: unknown): string[] {
    const props = new Set<string>();
    try {
        let obj: unknown = target;
        let depth = 0;
        while (obj && depth < 3) {
            Object.getOwnPropertyNames(obj).forEach((p) => props.add(p));
            obj = Object.getPrototypeOf(obj as object) as unknown;
            depth++;
        }
    } catch {
        // ignore
    }
    return Array.from(props.values());
}

export function resolvePath(root: unknown, pathSegments: string[]): unknown {
    let current = root;
    for (const seg of pathSegments) {
        if (!seg) continue;
        if (current == null) return undefined;
        try {
            current = (current as Record<string, unknown>)[seg];
        } catch {
            return undefined;
        }
    }
    return current;
}

export function isProbablyExpression(sourceCode: string): boolean {
    try {
        const trimmed = (sourceCode ?? '').trim();
        if (!trimmed) return false;
        if (
            /^(let|const|var|function|class|import|export|if|for|while|do|switch|try|with)\b/.test(
                trimmed,
            )
        ) {
            return false;
        }
        new Function(`return (${trimmed})`);
        return true;
    } catch {
        return false;
    }
}

export function rewriteTopLevelDeclarations(sourceCode: string): string {
    try {
        const lines = sourceCode.split(/\n/);
        const out: string[] = [];
        for (const line of lines) {
            const m = line.match(/^\s*(let|const|var)\s+(.+);?\s*$/);
            if (!m) {
                out.push(line);
                continue;
            }
            const decl = m[2]!;
            const parts = decl.split(',').map((s) => s.trim()).filter(Boolean);
            const assigns: string[] = [];
            for (const part of parts) {
                const eqIdx = part.indexOf('=');
                if (eqIdx >= 0) {
                    const name = part.slice(0, eqIdx).trim();
                    const expr = part.slice(eqIdx + 1).trim();
                    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
                        assigns.push(`globalThis.${name} = ${expr}`);
                    } else {
                        // Destructuring — fall back to original
                        assigns.length = 0;
                        break;
                    }
                } else {
                    const name = part.trim();
                    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
                        assigns.push(`globalThis.${name} = undefined`);
                    } else {
                        assigns.length = 0;
                        break;
                    }
                }
            }
            out.push(assigns.length > 0 ? assigns.join('; ') : line);
        }
        return out.join('\n');
    } catch {
        return sourceCode;
    }
}
