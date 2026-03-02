const ID_PATTERN = /^([A-Za-z0-9_-]|:|@|\.|\/)+$/;

export function isValidId(value: string): boolean {
    return ID_PATTERN.test(value);
}

export function assertValidId(value: string, label: string): void {
    if (!isValidId(value)) {
        throw new Error(`Invalid ${label} "${value}". Must match ^[A-Za-z0-9_\\-:@./]+$`);
    }
}

export function isValidTreeId(treeId: string): boolean {
    return isValidId(treeId);
}

export function assertValidTreeId(treeId: string): void {
    assertValidId(treeId, 'treeId');
}
