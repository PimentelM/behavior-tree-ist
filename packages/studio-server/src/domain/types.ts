import { ServerSettings } from "@bt-studio/studio-common";

export interface AgentConnection {
    connectionId: string;
    clientId: string;
    sessionId: string;
    connectedAt: number;
}

export interface UiConnection {
    connectionId: string;
    connectedAt: number;
}

export { ServerSettings };