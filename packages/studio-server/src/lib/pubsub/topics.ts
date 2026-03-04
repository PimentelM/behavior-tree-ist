// Topic pattern matching for subscriptions (supports wildcards)
export function topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
        const p = patternParts[i];
        const t = topicParts[i];

        if (p !== '*' && p !== t) {
            return false;
        }
    }

    return true;
}
