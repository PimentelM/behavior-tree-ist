import { describe, it, expect } from 'vitest';
import { topicMatches } from '../topics';

describe('topicMatches', () => {
    it('matches exact topics', () => {
        expect(topicMatches('system/connections', 'system/connections')).toBe(true);
        expect(topicMatches('player/123/logs', 'player/123/logs')).toBe(true);
    });

    it('returns false for different lengths', () => {
        expect(topicMatches('system', 'system/connections')).toBe(false);
        expect(topicMatches('player/123/logs/extra', 'player/123/logs')).toBe(false);
    });

    it('matches standard single segment wildcards', () => {
        expect(topicMatches('player/*/logs', 'player/123/logs')).toBe(true);
        expect(topicMatches('player/*/logs', 'player/abc/logs')).toBe(true);
        expect(topicMatches('system/*', 'system/connections')).toBe(true);
    });

    it('returns false for mismatched segments', () => {
        expect(topicMatches('system/*', 'player/123')).toBe(false);
        expect(topicMatches('player/123/logs', 'player/124/logs')).toBe(false);
    });
});
