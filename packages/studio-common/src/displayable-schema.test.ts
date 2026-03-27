import { describe, it, expect } from 'vitest';
import { RefChangeEventSchema } from './core-schemas';

const BASE = { tickId: 1, timestamp: 100, isAsync: false };

function parse(event: unknown) {
    return RefChangeEventSchema.parse(event);
}

describe('RefChangeEventSchema — displayValue adversarial', () => {
    describe('mutual exclusivity (no schema enforcement)', () => {
        it('accepts event with BOTH newValue and displayValue — no schema-level mutual exclusivity', () => {
            const result = parse({ ...BASE, newValue: 42, displayValue: 'forty-two' });

            expect(result.newValue).toBe(42);
            expect(result.displayValue).toBe('forty-two');
        });

        it('accepts event with NEITHER newValue nor displayValue', () => {
            const result = parse({ ...BASE });

            expect(result.newValue).toBeUndefined();
            expect(result.displayValue).toBeUndefined();
        });
    });

    describe('displayValue type enforcement', () => {
        it('accepts displayValue as empty string', () => {
            const result = parse({ ...BASE, displayValue: '' });

            expect(result.displayValue).toBe('');
        });

        it('rejects displayValue as number', () => {
            expect(() => parse({ ...BASE, displayValue: 42 })).toThrow();
        });

        it('rejects displayValue as object', () => {
            expect(() => parse({ ...BASE, displayValue: { label: 'foo' } })).toThrow();
        });

        it('rejects displayValue as null', () => {
            expect(() => parse({ ...BASE, displayValue: null })).toThrow();
        });

        it('rejects displayValue as boolean', () => {
            expect(() => parse({ ...BASE, displayValue: true })).toThrow();
        });
    });

    describe('strictness — no extra fields', () => {
        it('rejects event with unknown extra field', () => {
            expect(() => parse({ ...BASE, extraField: 'surprise' })).toThrow();
        });

        it('rejects event with multiple extra fields', () => {
            expect(() => parse({ ...BASE, a: 1, b: 2 })).toThrow();
        });
    });

    describe('required field validation', () => {
        it('rejects missing tickId', () => {
            expect(() => parse({ timestamp: 100, isAsync: false })).toThrow();
        });

        it('rejects missing timestamp', () => {
            expect(() => parse({ tickId: 1, isAsync: false })).toThrow();
        });

        it('rejects missing isAsync', () => {
            expect(() => parse({ tickId: 1, timestamp: 100 })).toThrow();
        });

        it('rejects non-integer tickId', () => {
            expect(() => parse({ tickId: 1.5, timestamp: 100, isAsync: false })).toThrow();
        });

        it('rejects non-integer nodeId', () => {
            expect(() => parse({ ...BASE, nodeId: 3.7 })).toThrow();
        });
    });

    describe('optional field edge cases', () => {
        it('accepts refName as undefined (field omitted)', () => {
            const result = parse({ ...BASE });

            expect(result.refName).toBeUndefined();
        });

        it('accepts refName as explicit undefined equivalent — field missing', () => {
            const input = { tickId: 1, timestamp: 100, isAsync: false };
            const result = parse(input);

            expect(result.refName).toBeUndefined();
        });

        it('accepts refName as empty string', () => {
            const result = parse({ ...BASE, refName: '' });

            expect(result.refName).toBe('');
        });
    });

    describe('newValue permissiveness', () => {
        it('accepts newValue as null', () => {
            const result = parse({ ...BASE, newValue: null });

            expect(result.newValue).toBeNull();
        });

        it('accepts newValue as deeply nested object', () => {
            const complex = { a: { b: { c: [1, 2, { d: true }] } } };
            const result = parse({ ...BASE, newValue: complex });

            expect(result.newValue).toEqual(complex);
        });

        it('accepts newValue as array', () => {
            const result = parse({ ...BASE, newValue: [1, 'two', null, false] });

            expect(result.newValue).toEqual([1, 'two', null, false]);
        });

        it('accepts newValue as number 0 (falsy)', () => {
            const result = parse({ ...BASE, newValue: 0 });

            expect(result.newValue).toBe(0);
        });

        it('accepts newValue as empty string', () => {
            const result = parse({ ...BASE, newValue: '' });

            expect(result.newValue).toBe('');
        });
    });

    describe('round-trip shape preservation', () => {
        it('displayValue event preserves all fields after parse', () => {
            const input = {
                tickId: 7,
                timestamp: 999,
                refName: 'enemy',
                nodeId: 3,
                displayValue: 'Orc (hp: 200)',
                isAsync: true,
            };

            const result = parse(input);

            expect(result).toEqual({
                tickId: 7,
                timestamp: 999,
                refName: 'enemy',
                nodeId: 3,
                displayValue: 'Orc (hp: 200)',
                newValue: undefined,
                isAsync: true,
            });
        });

        it('newValue event preserves all fields after parse', () => {
            const input = {
                tickId: 2,
                timestamp: 50,
                refName: 'counter',
                nodeId: 1,
                newValue: 42,
                isAsync: false,
            };

            const result = parse(input);

            expect(result).toEqual({
                tickId: 2,
                timestamp: 50,
                refName: 'counter',
                nodeId: 1,
                newValue: 42,
                displayValue: undefined,
                isAsync: false,
            });
        });
    });
});
