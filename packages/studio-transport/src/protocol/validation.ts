export function isValidTreeId(treeId: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(treeId);
}

export function assertValidTreeId(treeId: string): void {
    if (!isValidTreeId(treeId)) {
        throw new Error(`Invalid treeId "${treeId}". Must match ^[A-Za-z0-9_-]+$`);
    }
}
