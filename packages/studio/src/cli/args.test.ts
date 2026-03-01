import { describe, it, expect } from 'vitest';
import { parseArgs } from './args';

describe('CLI Args', () => {
    it('No flags defaults to { server: true, ui: true, mockClient: false }', () => {
        const res = parseArgs([]);
        expect(res.server).toBe(true);
        expect(res.ui).toBe(true);
        expect(res.mockClient).toBe(false);
    });

    it('--demo results in { server: true, ui: true, mockClient: true }', () => {
        const res = parseArgs(['--demo']);
        expect(res.server).toBe(true);
        expect(res.ui).toBe(true);
        expect(res.mockClient).toBe(true);
    });

    it('--server only defaults to { server: true, ui: false, mockClient: false }', () => {
        const res = parseArgs(['--server']);
        expect(res.server).toBe(true);
        expect(res.ui).toBe(false);
        expect(res.mockClient).toBe(false);
    });

    it('--mock-client only defaults to { server: false, ui: false, mockClient: true }', () => {
        const res = parseArgs(['--mock-client']);
        expect(res.server).toBe(false);
        expect(res.ui).toBe(false);
        expect(res.mockClient).toBe(true);
    });

    it('--host and --port parsing', () => {
        const res = parseArgs(['--host', '0.0.0.0', '--port', '8080', '--ui-port', '8081']);
        expect(res.host).toBe('0.0.0.0');
        expect(res.port).toBe(8080);
        expect(res.uiPort).toBe(8081);
    });

    it('Combined flags work', () => {
        const res = parseArgs(['--server', '--mock-client', '--host', 'localhost']);
        expect(res.server).toBe(true);
        expect(res.ui).toBe(false);
        expect(res.mockClient).toBe(true);
        expect(res.host).toBe('localhost');
    });
});
