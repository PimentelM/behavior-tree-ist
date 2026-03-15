import { describe, expect, it } from 'vitest';
import {
    getPropertyNamesDeep,
    isProbablyExpression,
    resolvePath,
    rewriteTopLevelDeclarations,
    toDisplayString,
} from './repl-plugin';

// ---------------------------------------------------------------------------
// toDisplayString
// ---------------------------------------------------------------------------
describe('toDisplayString', () => {
    it('handles primitives', () => {
        expect(toDisplayString(null)).toBe('null');
        expect(toDisplayString(undefined)).toBe('undefined');
        expect(toDisplayString('hello')).toBe('hello');
        expect(toDisplayString(42)).toBe('42');
        expect(toDisplayString(true)).toBe('true');
        expect(toDisplayString(BigInt(99))).toBe('99');
    });

    it('handles functions', () => {
        expect(toDisplayString(function myFn() {})).toBe('[Function myFn]');
        expect(toDisplayString(() => {})).toBe('[Function anonymous]');
    });

    it('handles symbols', () => {
        expect(toDisplayString(Symbol('s'))).toBe('Symbol(s)');
    });

    it('JSON-stringifies plain objects', () => {
        const result = toDisplayString({ a: 1 });
        expect(JSON.parse(result)).toEqual({ a: 1 });
    });

    it('handles bigint in objects via replacer', () => {
        const result = toDisplayString({ n: BigInt(1) });
        expect(result).toContain('"1"');
    });

    it('falls back for circular objects', () => {
        const obj: Record<string, unknown> = {};
        obj['self'] = obj;
        const result = toDisplayString(obj);
        expect(result).toContain('Object');
    });
});

// ---------------------------------------------------------------------------
// getPropertyNamesDeep
// ---------------------------------------------------------------------------
describe('getPropertyNamesDeep', () => {
    it('returns own properties', () => {
        const props = getPropertyNamesDeep({ x: 1, y: 2 });
        expect(props).toContain('x');
        expect(props).toContain('y');
    });

    it('walks up prototype chain', () => {
        class Base { baseMethod() {} }
        class Child extends Base { childMethod() {} }
        const props = getPropertyNamesDeep(new Child());
        expect(props).toContain('baseMethod');
        expect(props).toContain('childMethod');
    });

    it('handles null/undefined gracefully', () => {
        expect(getPropertyNamesDeep(null)).toEqual([]);
        expect(getPropertyNamesDeep(undefined)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------
describe('resolvePath', () => {
    it('resolves nested path', () => {
        const root = { a: { b: { c: 42 } } };
        expect(resolvePath(root, ['a', 'b', 'c'])).toBe(42);
    });

    it('returns undefined for missing segment', () => {
        expect(resolvePath({ a: 1 }, ['b', 'c'])).toBeUndefined();
    });

    it('skips empty segments', () => {
        expect(resolvePath({ a: { b: 1 } }, ['', 'a', '', 'b'])).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// isProbablyExpression
// ---------------------------------------------------------------------------
describe('isProbablyExpression', () => {
    it('detects simple expressions', () => {
        expect(isProbablyExpression('1 + 2')).toBe(true);
        expect(isProbablyExpression('Math.PI')).toBe(true);
        expect(isProbablyExpression('"hello"')).toBe(true);
    });

    it('rejects statement keywords', () => {
        expect(isProbablyExpression('let x = 1')).toBe(false);
        expect(isProbablyExpression('const y = 2')).toBe(false);
        expect(isProbablyExpression('if (true) {}')).toBe(false);
        expect(isProbablyExpression('function foo() {}')).toBe(false);
    });

    it('returns false for empty/whitespace', () => {
        expect(isProbablyExpression('')).toBe(false);
        expect(isProbablyExpression('   ')).toBe(false);
    });

    it('returns false for syntax errors', () => {
        expect(isProbablyExpression('(')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// rewriteTopLevelDeclarations
// ---------------------------------------------------------------------------
describe('rewriteTopLevelDeclarations', () => {
    it('rewrites let/const/var single declarations', () => {
        expect(rewriteTopLevelDeclarations('let x = 1')).toBe('globalThis.x = 1');
        expect(rewriteTopLevelDeclarations('const y = "hello"')).toBe('globalThis.y = "hello"');
        expect(rewriteTopLevelDeclarations('var z = true')).toBe('globalThis.z = true');
    });

    it('rewrites declaration without initializer', () => {
        expect(rewriteTopLevelDeclarations('let x')).toBe('globalThis.x = undefined');
    });

    it('preserves non-declaration lines', () => {
        expect(rewriteTopLevelDeclarations('console.log(1)')).toBe('console.log(1)');
        expect(rewriteTopLevelDeclarations('x = 5')).toBe('x = 5');
    });

    it('falls back to original for destructuring', () => {
        const code = 'const { a, b } = obj';
        expect(rewriteTopLevelDeclarations(code)).toBe(code);
    });

    it('handles multi-line code', () => {
        const result = rewriteTopLevelDeclarations('let a = 1\nconsole.log(a)');
        expect(result).toBe('globalThis.a = 1\nconsole.log(a)');
    });
});
