import { Knex } from 'knex';
import { WebSocketServerInterface } from '../infra/websocket/interfaces';
import { MessageRouterInterface } from './interfaces';
import { AgentConnectionRegistryInterface, CommandBrokerInterface, ClientRepositoryInterface, SessionRepositoryInterface, TreeRepositoryInterface, TickRepositoryInterface, SettingsRepositoryInterface } from '../domain/interfaces';
import { StudioServerConfig } from '../configuration';

export interface InfrastructureClients {
    knex: Knex;
}

export interface InfrastructureServices {
    wsServer: WebSocketServerInterface;
    messageRouter: MessageRouterInterface;
}

export interface DomainServices {
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    commandBroker: CommandBrokerInterface;
}

export interface RepositoryServices {
    clientRepository: ClientRepositoryInterface;
    sessionRepository: SessionRepositoryInterface;
    treeRepository: TreeRepositoryInterface;
    tickRepository: TickRepositoryInterface;
    settingsRepository: SettingsRepositoryInterface;
}

export type AppDependencies =
    InfrastructureClients &
    InfrastructureServices &
    DomainServices &
    RepositoryServices & {
        config: StudioServerConfig;
    };
