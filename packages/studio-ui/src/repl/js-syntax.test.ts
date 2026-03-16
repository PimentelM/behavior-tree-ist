import { describe, expect, it } from 'vitest';
import { highlightJs } from './js-syntax';

// ANSI code constants (mirror js-syntax.ts)
const RESET = '\x1b[0m';
const C_KEYWORD = '\x1b[35m';
const C_NUMBER = '\x1b[36m';
const C_COMMENT = '\x1b[90m';
const C_STRING = '\x1b[32m';
const C_REGEX = '\x1b[33m';
const C_PUNCT = '\x1b[97m';

function kw(s: string) { return C_KEYWORD + s; }
function num(s: string) { return C_NUMBER + s; }
function _str(s: string) { return C_STRING + s; }
function _cmt(s: string) { return C_COMMENT + s; }
function re(s: string) { return C_REGEX + s; }
function _pt(s: string) { return C_PUNCT + s; }
function _id(s: string) { return RESET + s; }

describe('highlightJs', () => {
    it('returns empty string for empty input', () => {
        expect(highlightJs('')).toBe('');
    });

    it('wraps keywords in magenta', () => {
        const result = highlightJs('const');
        expect(result).toContain(C_KEYWORD + 'const');
    });

    it('wraps strings in green — double-quote', () => {
        expect(highlightJs('"hello"')).toContain(C_STRING + '"hello"');
    });

    it('wraps strings in green — single-quote', () => {
        expect(highlightJs("'world'")).toContain(C_STRING + "'world'");
    });

    it('wraps strings in green — backtick template', () => {
        expect(highlightJs('`foo`')).toContain(C_STRING + '`foo`');
    });

    it('handles unterminated string gracefully', () => {
        const result = highlightJs('"unterminated');
        expect(result).toContain(C_STRING + '"unterminated');
    });

    it('wraps integers in cyan', () => {
        expect(highlightJs('42')).toContain(C_NUMBER + '42');
    });

    it('wraps floats in cyan', () => {
        expect(highlightJs('3.14')).toContain(C_NUMBER + '3.14');
    });

    it('wraps hex numbers in cyan', () => {
        expect(highlightJs('0xff')).toContain(C_NUMBER + '0xff');
    });

    it('wraps octal numbers in cyan', () => {
        expect(highlightJs('0o77')).toContain(C_NUMBER + '0o77');
    });

    it('wraps binary numbers in cyan', () => {
        expect(highlightJs('0b101')).toContain(C_NUMBER + '0b101');
    });

    it('wraps bigint suffix in cyan', () => {
        expect(highlightJs('100n')).toContain(C_NUMBER + '100n');
    });

    it('wraps true in cyan', () => {
        expect(highlightJs('true')).toContain(C_NUMBER + 'true');
    });

    it('wraps false in cyan', () => {
        expect(highlightJs('false')).toContain(C_NUMBER + 'false');
    });

    it('wraps null in gray', () => {
        expect(highlightJs('null')).toContain(C_COMMENT + 'null');
    });

    it('wraps undefined in gray', () => {
        expect(highlightJs('undefined')).toContain(C_COMMENT + 'undefined');
    });

    it('wraps NaN in gray', () => {
        expect(highlightJs('NaN')).toContain(C_COMMENT + 'NaN');
    });

    it('wraps Infinity in gray', () => {
        expect(highlightJs('Infinity')).toContain(C_COMMENT + 'Infinity');
    });

    it('wraps line comments in gray', () => {
        expect(highlightJs('// comment')).toContain(C_COMMENT + '// comment');
    });

    it('wraps block comments in gray', () => {
        expect(highlightJs('/* block */')).toContain(C_COMMENT + '/* block */');
    });

    it('wraps regex literals in yellow', () => {
        expect(highlightJs('/foo/g')).toContain(C_REGEX + '/foo/g');
    });

    it('tokenizes mixed input: const x = 42', () => {
        const result = highlightJs('const x = 42');
        expect(result).toContain(kw('const'));
        expect(result).toContain(num('42'));
        // ends with RESET
        expect(result.endsWith(RESET)).toBe(true);
    });

    it('does not change visible length (ANSI codes are zero-width)', () => {
        const src = 'const x = 42';
        const result = highlightJs(src);
        // Strip all ANSI sequences
        // eslint-disable-next-line no-control-regex
        const stripped = result.replace(/\x1b\[[0-9;]*m/g, '');
        expect(stripped).toBe(src);
    });

    it('handles backslash escapes inside strings', () => {
        const src = '"he\\"llo"';
        const result = highlightJs(src);
        expect(result).toContain(C_STRING + '"he\\"llo"');
    });

    it('wraps punctuation in bright white', () => {
        expect(highlightJs('(')).toContain(C_PUNCT + '(');
        expect(highlightJs('{')).toContain(C_PUNCT + '{');
        expect(highlightJs(',')).toContain(C_PUNCT + ',');
    });

    it('passes identifiers through without colour (reset)', () => {
        const result = highlightJs('myVar');
        expect(result).toContain(RESET + 'myVar');
    });

    it('complex: async function with await', () => {
        const src = 'async function foo() { return await bar; }';
        const result = highlightJs(src);
        expect(result).toContain(kw('async'));
        expect(result).toContain(kw('function'));
        expect(result).toContain(kw('return'));
        expect(result).toContain(kw('await'));
    });

    it('regex after assignment: x = /pattern/i', () => {
        const result = highlightJs('x = /pattern/i');
        expect(result).toContain(re('/pattern/i'));
    });

    it('division operator is not treated as regex: a/b', () => {
        const result = highlightJs('a/b');
        // '/' should not be a regex start after an identifier
        expect(result).not.toContain(C_REGEX);
    });
});
