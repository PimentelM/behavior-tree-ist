import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RefTracesPanel } from '../components/panels/RefTracesPanel';
import type { RefChangeEvent } from '@bt-studio/core';

afterEach(cleanup);

const noop = () => {};

function makeEvent(overrides: Partial<RefChangeEvent> = {}): RefChangeEvent {
    return {
        tickId: 1,
        timestamp: 100,
        refName: 'myRef',
        isAsync: false,
        ...overrides,
    };
}

function renderPanel(events: RefChangeEvent[], viewedTickId: number | null = null) {
    return render(
        <RefTracesPanel
            events={events}
            viewedTickId={viewedTickId}
            onGoToTick={noop}
            onFocusActorNode={noop}
        />,
    );
}

describe('RefTracesPanel — formatEventValue adversarial', () => {
    describe('displayValue precedence', () => {
        it('renders displayValue when present instead of newValue', () => {
            const event = makeEvent({ displayValue: 'Orc (hp: 200)', newValue: undefined });

            renderPanel([event]);

            expect(screen.getAllByText('Orc (hp: 200)').length).toBeGreaterThan(0);
        });

        it('renders displayValue when both displayValue and newValue are set', () => {
            const event = makeEvent({ displayValue: 'display-wins', newValue: 999 });

            renderPanel([event]);

            expect(screen.getAllByText('display-wins').length).toBeGreaterThan(0);
            expect(screen.queryByText('999')).toBeNull();
        });

        it('renders displayValue as empty string (not falling through to newValue fallback)', () => {
            const event = makeEvent({ displayValue: '', newValue: 42 });

            renderPanel([event]);

            // empty string is a valid display value — newValue must not show
            expect(screen.queryByText('42')).toBeNull();
        });

        it('renders long displayValue without error', () => {
            const longValue = 'x'.repeat(1200);
            const event = makeEvent({ displayValue: longValue });

            renderPanel([event]);

            expect(screen.getAllByText(longValue).length).toBeGreaterThan(0);
        });

        it('renders HTML-like displayValue as escaped text, not injected markup', () => {
            const xss = '<script>alert(1)</script>';
            const event = makeEvent({ displayValue: xss });

            renderPanel([event]);

            // React renders as text — the literal string appears, no DOM injection
            expect(screen.getAllByText(xss).length).toBeGreaterThan(0);
            expect(document.querySelector('script')).toBeNull();
        });
    });

    describe('newValue fallback formatting', () => {
        it('renders null newValue as "null"', () => {
            const event = makeEvent({ newValue: null });

            renderPanel([event]);

            expect(screen.getAllByText('null').length).toBeGreaterThan(0);
        });

        it('renders undefined newValue (neither field set) as "null"', () => {
            const event = makeEvent({ newValue: undefined });

            renderPanel([event]);

            expect(screen.getAllByText('null').length).toBeGreaterThan(0);
        });

        it('renders number newValue as its string representation', () => {
            const event = makeEvent({ newValue: 42 });

            renderPanel([event]);

            expect(screen.getAllByText('42').length).toBeGreaterThan(0);
        });

        it('renders zero newValue as "0" (not "null")', () => {
            const event = makeEvent({ newValue: 0 });

            renderPanel([event]);

            expect(screen.getAllByText('0').length).toBeGreaterThan(0);
            expect(screen.queryAllByText('null')).toHaveLength(0);
        });

        it('renders boolean true newValue as "true"', () => {
            const event = makeEvent({ newValue: true });

            renderPanel([event]);

            expect(screen.getAllByText('true').length).toBeGreaterThan(0);
        });

        it('renders boolean false newValue as "false" (not "null")', () => {
            const event = makeEvent({ newValue: false });

            renderPanel([event]);

            expect(screen.getAllByText('false').length).toBeGreaterThan(0);
            expect(screen.queryAllByText('null')).toHaveLength(0);
        });

        it('renders string newValue with surrounding quotes', () => {
            const event = makeEvent({ newValue: 'hello' });

            renderPanel([event]);

            expect(screen.getAllByText('"hello"').length).toBeGreaterThan(0);
        });

        it('renders empty string newValue as quoted empty string', () => {
            const event = makeEvent({ newValue: '' });

            renderPanel([event]);

            expect(screen.getAllByText('""').length).toBeGreaterThan(0);
        });

        it('renders object newValue as JSON', () => {
            const event = makeEvent({ newValue: { x: 1, y: 2 } });

            renderPanel([event]);

            // JSON.stringify with indent 2 produces multi-line text — match via text function
            expect(screen.getAllByText((content) => content.includes('"x": 1') && content.includes('"y": 2')).length).toBeGreaterThan(0);
        });

        it('renders circular-ref newValue via String() fallback without throwing', () => {
            const obj: Record<string, unknown> = {};
            obj['self'] = obj;
            const event = makeEvent({ newValue: obj });

            // Should not throw — falls back to String(value) = '[object Object]'
            expect(() => renderPanel([event])).not.toThrow();
        });
    });

    describe('multiple events', () => {
        it('renders distinct displayValues for multiple events', () => {
            const events = [
                makeEvent({ tickId: 1, refName: 'a', displayValue: 'val-one' }),
                makeEvent({ tickId: 2, refName: 'b', displayValue: 'val-two' }),
            ];

            renderPanel(events);

            expect(screen.getAllByText('val-one').length).toBeGreaterThan(0);
            expect(screen.getAllByText('val-two').length).toBeGreaterThan(0);
        });

        it('uses callbacks (no crash with vi.fn())', () => {
            const goToTick = vi.fn();
            const focusNode = vi.fn();
            const event = makeEvent({ displayValue: 'ok', nodeId: 5 });

            render(
                <RefTracesPanel
                    events={[event]}
                    viewedTickId={null}
                    onGoToTick={goToTick}
                    onFocusActorNode={focusNode}
                />,
            );

            expect(screen.getAllByText('ok').length).toBeGreaterThan(0);
        });
    });
});
