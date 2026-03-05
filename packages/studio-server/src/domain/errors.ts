export const DomainErrorCode = {
    ClientNotFound: 'CLIENT_NOT_FOUND',
    SessionNotFound: 'SESSION_NOT_FOUND',
    TreeNotFound: 'TREE_NOT_FOUND',
    AgentNotConnected: 'AGENT_NOT_CONNECTED',
    CommandTimeout: 'COMMAND_TIMEOUT',
} as const;

export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];
