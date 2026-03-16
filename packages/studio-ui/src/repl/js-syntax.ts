/**
 * Minimal JS syntax highlighter for xterm.js input lines.
 *
 * Returns an ANSI-escaped string with the same visible character count as the
 * input (ANSI escapes are zero-width), so caller cursor arithmetic is unaffected.
 *
 * Palette maps to the Frida-style replTheme used in ReplTerminal.
 */

// ANSI SGR helpers
const RESET = '\x1b[0m';

const C_KEYWORD = '\x1b[35m'; // magenta — const/let/return/…
const C_NUMBER = '\x1b[36m'; // cyan    — numeric literals + booleans
const C_COMMENT = '\x1b[90m'; // gray    — // … and /* … */
const C_STRING = '\x1b[32m'; // green   — "…" '…' `…`
const C_REGEX = '\x1b[33m'; // yellow  — /pattern/flags
const C_PUNCT = '\x1b[97m'; // bright white — () [] {} . , ; => …

const KEYWORDS = new Set([
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'export', 'extends',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
    'let', 'new', 'of', 'return', 'static', 'super', 'switch',
    'this', 'throw', 'try', 'typeof', 'var', 'void',
    'while', 'with', 'yield', 'async', 'await',
]);

/** Treated like numeric literals (cyan) */
const BOOL_LIKE = new Set(['true', 'false']);

/** Treated like comments (gray) */
const NULL_LIKE = new Set(['null', 'undefined', 'NaN', 'Infinity']);

// Token kinds that suggest a regex can follow a `/`
const REGEX_PRECEDERS = new Set([
    '=', '+=', '-=', '*=', '/=', '%=', '**=', '&&=', '||=', '??=',
    '==', '===', '!=', '!==', '<', '>', '<=', '>=',
    '(', '[', '{', ',', ';', ':', '?', '!', '&&', '||', '??',
    '=>', 'return', 'typeof', 'instanceof', 'in', 'of', 'delete', 'void', 'new',
]);

type TokenKind = 'keyword' | 'number' | 'comment' | 'string' | 'regex' | 'punct' | 'other';

interface Token {
    kind: TokenKind;
    value: string;
}

/** Tokenise a JS snippet into a flat list of tokens. */
function tokenise(src: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    // Returns the most recent non-whitespace token value, used for regex heuristic
    function lastNonWsValue(): string {
        for (let k = tokens.length - 1; k >= 0; k--) {
            if ((tokens[k] as Token).kind !== 'other' || (tokens[k] as Token).value.trim() !== '') {
                return (tokens[k] as Token).value;
            }
        }
        return '';
    }

    while (i < src.length) {
        const ch = src[i] as string;

        // ---- whitespace — pass through as 'other' ----
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            tokens.push({ kind: 'other', value: ch });
            i++;
            continue;
        }

        // ---- line comment ----
        if (ch === '/' && src[i + 1] as string === '/') {
            const start = i;
            while (i < src.length && src[i] !== '\n') i++;
            tokens.push({ kind: 'comment', value: src.slice(start, i) });
            continue;
        }

        // ---- block comment ----
        if (ch === '/' && src[i + 1] as string === '*') {
            const start = i;
            i += 2;
            while (i < src.length && !(src[i - 1] === '*' && src[i] === '/')) i++;
            i++; // consume closing '/'
            tokens.push({ kind: 'comment', value: src.slice(start, i) });
            continue;
        }

        // ---- regex literal ----
        // Heuristic: '/' is a regex start when preceded by an operator/keyword context
        if (ch === '/') {
            const prev = lastNonWsValue();
            const isRegex = prev === '' || REGEX_PRECEDERS.has(prev);
            if (isRegex) {
                const start = i++;
                // consume until unescaped '/' (skip character classes [])
                let inClass = false;
                while (i < src.length) {
                    if (src[i] === '\\') { i += 2; continue; }
                    if (src[i] === '[') { inClass = true; i++; continue; }
                    if (src[i] === ']') { inClass = false; i++; continue; }
                    if (src[i] === '/' && !inClass) { i++; break; }
                    i++;
                }
                // consume flags
                while (i < src.length && /[gimsuy]/.test(src[i] as string)) i++;
                tokens.push({ kind: 'regex', value: src.slice(start, i) });
                continue;
            }
        }

        // ---- string: double-quote ----
        if (ch === '"') {
            const start = i++;
            while (i < src.length && src[i] !== '"' && src[i] !== '\n') {
                if (src[i] === '\\') i++;
                i++;
            }
            if (i < src.length && src[i] === '"') i++;
            tokens.push({ kind: 'string', value: src.slice(start, i) });
            continue;
        }

        // ---- string: single-quote ----
        if (ch === "'") {
            const start = i++;
            while (i < src.length && src[i] !== "'" && src[i] !== '\n') {
                if (src[i] === '\\') i++;
                i++;
            }
            if (i < src.length && src[i] === "'") i++;
            tokens.push({ kind: 'string', value: src.slice(start, i) });
            continue;
        }

        // ---- template literal (no nested ${} colouring — kept simple) ----
        if (ch === '`') {
            const start = i++;
            while (i < src.length && src[i] !== '`') {
                if (src[i] === '\\') i++;
                i++;
            }
            if (i < src.length && src[i] === '`') i++;
            tokens.push({ kind: 'string', value: src.slice(start, i) });
            continue;
        }

        // ---- numeric literal ----
        // Starts with digit, or '.' followed by digit
        if (
            (ch >= '0' && ch <= '9') ||
            (ch === '.' && (src[i + 1] as string) >= '0' && (src[i + 1] as string) <= '9')
        ) {
            const start = i;
            if (ch === '0' && (src[i + 1] as string === 'x' || src[i + 1] as string === 'X')) {
                // hex
                i += 2;
                while (i < src.length && /[0-9a-fA-F_]/.test(src[i] as string)) i++;
            } else if (ch === '0' && (src[i + 1] as string === 'o' || src[i + 1] as string === 'O')) {
                // octal
                i += 2;
                while (i < src.length && /[0-7_]/.test(src[i] as string)) i++;
            } else if (ch === '0' && (src[i + 1] as string === 'b' || src[i + 1] as string === 'B')) {
                // binary
                i += 2;
                while (i < src.length && /[01_]/.test(src[i] as string)) i++;
            } else {
                // decimal / float
                while (i < src.length && /[0-9_.]/.test(src[i] as string)) i++;
                // optional exponent
                if (i < src.length && (src[i] === 'e' || src[i] === 'E')) {
                    i++;
                    if (i < src.length && (src[i] === '+' || src[i] === '-')) i++;
                    while (i < src.length && /[0-9_]/.test(src[i] as string)) i++;
                }
            }
            // bigint suffix
            if (i < src.length && src[i] === 'n') i++;
            tokens.push({ kind: 'number', value: src.slice(start, i) });
            continue;
        }

        // ---- identifier or keyword ----
        if (/[a-zA-Z_$]/.test(ch)) {
            const start = i;
            while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i] as string)) i++;
            const word = src.slice(start, i);
            if (KEYWORDS.has(word)) {
                tokens.push({ kind: 'keyword', value: word });
            } else if (BOOL_LIKE.has(word)) {
                tokens.push({ kind: 'number', value: word }); // cyan — same as numbers
            } else if (NULL_LIKE.has(word)) {
                tokens.push({ kind: 'comment', value: word }); // gray
            } else {
                tokens.push({ kind: 'other', value: word }); // default/reset
            }
            continue;
        }

        // ---- multi-char operators / punctuation ----
        const two = src.slice(i, i + 3);
        const twoOp = [
            '===', '!==', '**=', '&&=', '||=', '??=', '>>>=',
            '...', '=>',
        ].find((op) => two.startsWith(op));
        if (twoOp) {
            tokens.push({ kind: 'punct', value: twoOp });
            i += twoOp.length;
            continue;
        }

        const twoChar = src.slice(i, i + 2);
        const twoOp2 = [
            '==', '!=', '<=', '>=', '&&', '||', '??',
            '+=', '-=', '*=', '/=', '%=', '**',
            '++', '--', '<<', '>>', '>>>', '=>',
        ].find((op) => twoChar === op);
        if (twoOp2) {
            tokens.push({ kind: 'punct', value: twoOp2 });
            i += 2;
            continue;
        }

        // ---- single-char punctuation ----
        const SINGLE_PUNCT = '()[]{}.,;:?!~^&|<>=+-*/%@';
        if (SINGLE_PUNCT.includes(ch)) {
            tokens.push({ kind: 'punct', value: ch });
            i++;
            continue;
        }

        // ---- anything else (e.g. backslash outside string) ----
        tokens.push({ kind: 'other', value: ch });
        i++;
    }

    return tokens;
}

function colourFor(kind: TokenKind): string {
    switch (kind) {
        case 'keyword': return C_KEYWORD;
        case 'number': return C_NUMBER;
        case 'comment': return C_COMMENT;
        case 'string': return C_STRING;
        case 'regex': return C_REGEX;
        case 'punct': return C_PUNCT;
        case 'other': return RESET;
    }
}

/**
 * Apply ANSI syntax highlighting to a JavaScript snippet.
 *
 * The returned string has the same *visible* character count as `src`
 * (ANSI escapes are zero-width), so caller cursor arithmetic remains valid.
 */
export function highlightJs(src: string): string {
    if (!src) return src;
    const tokens = tokenise(src);
    let out = '';
    for (const tok of tokens) {
        out += colourFor(tok.kind) + tok.value;
    }
    out += RESET;
    return out;
}
