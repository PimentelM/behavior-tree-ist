export class ClientNotFoundError extends Error {
    constructor(clientId: string) {
        super(`Client "${clientId}" not found`);
        this.name = "ClientNotFoundError";
    }
}

export class TreeNotFoundError extends Error {
    constructor(clientId: string, treeId: string) {
        super(`Tree "${treeId}" not found for client "${clientId}"`);
        this.name = "TreeNotFoundError";
    }
}

export class ClientOfflineError extends Error {
    constructor(clientId: string) {
        super(`Client "${clientId}" is offline`);
        this.name = "ClientOfflineError";
    }
}
