import { NodeFlags, hasFlag, SerializableNode } from "../base/types";
import { IndexedNode } from "./types";

export class TreeIndex {
    private readonly byId = new Map<number, IndexedNode>();
    private readonly byName = new Map<string, IndexedNode[]>();
    private readonly byTag = new Map<string, IndexedNode[]>();
    private readonly byFlag = new Map<number, IndexedNode[]>();
    private readonly _preOrder: number[] = [];

    constructor(root: SerializableNode) {
        this.indexNode(root, undefined, 0);
    }

    private indexNode(node: SerializableNode, parentId: number | undefined, depth: number): void {
        const childrenIds = node.children?.map(c => c.id) ?? [];
        const tags = node.tags ?? [];

        const indexed: IndexedNode = {
            id: node.id,
            nodeFlags: node.nodeFlags,
            defaultName: node.defaultName,
            name: node.name,
            tags,
            parentId,
            childrenIds,
            depth,
        };

        this.byId.set(node.id, indexed);
        this._preOrder.push(node.id);

        // Index by name (use displayable name: name if set, else defaultName)
        const nameKey = node.name || node.defaultName;
        const nameList = this.byName.get(nameKey);
        if (nameList) {
            nameList.push(indexed);
        } else {
            this.byName.set(nameKey, [indexed]);
        }

        // Index by tags
        for (const tag of tags) {
            const tagList = this.byTag.get(tag);
            if (tagList) {
                tagList.push(indexed);
            } else {
                this.byTag.set(tag, [indexed]);
            }
        }

        // Index by individual flag bits
        for (const flagValue of Object.values(NodeFlags)) {
            if (typeof flagValue === "number" && hasFlag(node.nodeFlags, flagValue)) {
                const flagList = this.byFlag.get(flagValue);
                if (flagList) {
                    flagList.push(indexed);
                } else {
                    this.byFlag.set(flagValue, [indexed]);
                }
            }
        }

        // Recurse children
        if (node.children) {
            for (const child of node.children) {
                this.indexNode(child, node.id, depth + 1);
            }
        }
    }

    get preOrder(): readonly number[] {
        return this._preOrder;
    }

    get size(): number {
        return this.byId.size;
    }

    getById(id: number): IndexedNode | undefined {
        return this.byId.get(id);
    }

    getByName(name: string): readonly IndexedNode[] {
        return this.byName.get(name) ?? [];
    }

    getByTag(tag: string): readonly IndexedNode[] {
        return this.byTag.get(tag) ?? [];
    }

    getByFlag(flag: number): readonly IndexedNode[] {
        return this.byFlag.get(flag) ?? [];
    }

    getLeaves(): readonly IndexedNode[] {
        return this.getByFlag(NodeFlags.Leaf);
    }

    getComposites(): readonly IndexedNode[] {
        return this.getByFlag(NodeFlags.Composite);
    }

    getDecorators(): readonly IndexedNode[] {
        return this.getByFlag(NodeFlags.Decorator);
    }

    getSubTrees(): readonly IndexedNode[] {
        return this.getByFlag(NodeFlags.SubTree);
    }

    getChildren(nodeId: number): readonly IndexedNode[] {
        const node = this.byId.get(nodeId);
        if (!node) return [];
        return node.childrenIds.map(id => this.byId.get(id)!);
    }

    getParent(nodeId: number): IndexedNode | undefined {
        const node = this.byId.get(nodeId);
        if (!node || node.parentId === undefined) return undefined;
        return this.byId.get(node.parentId);
    }

    getAncestors(nodeId: number): IndexedNode[] {
        const result: IndexedNode[] = [];
        let current = this.getParent(nodeId);
        while (current) {
            result.push(current);
            current = current.parentId !== undefined ? this.byId.get(current.parentId) : undefined;
        }
        return result;
    }

    getDescendants(nodeId: number): IndexedNode[] {
        const result: IndexedNode[] = [];
        const node = this.byId.get(nodeId);
        if (!node) return result;

        // Use stack with reverse push for correct pre-order traversal
        const stack: number[] = [];
        for (let i = node.childrenIds.length - 1; i >= 0; i--) {
            stack.push(node.childrenIds[i]);
        }
        while (stack.length > 0) {
            const id = stack.pop()!;
            const child = this.byId.get(id)!;
            result.push(child);
            for (let i = child.childrenIds.length - 1; i >= 0; i--) {
                stack.push(child.childrenIds[i]);
            }
        }
        return result;
    }

    getAllTags(): string[] {
        return Array.from(this.byTag.keys());
    }

    getPathString(nodeId: number): string {
        const node = this.byId.get(nodeId);
        if (!node) return "";
        const ancestors = this.getAncestors(nodeId);
        const parts = ancestors.reverse().map(n => n.name || n.defaultName);
        parts.push(node.name || node.defaultName);
        return parts.join(" > ");
    }
}
