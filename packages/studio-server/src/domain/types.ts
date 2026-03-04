import { ServerSettings } from "@behavior-tree-ist/studio-common";

export interface AgentConnection {
    connectionId: string;
    clientId: string;
    sessionId: string;
    connectedAt: number;
}

export { ServerSettings };