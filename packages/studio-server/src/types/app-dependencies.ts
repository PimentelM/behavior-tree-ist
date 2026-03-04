import type { Knex } from 'knex';
import { WebSocketServerInterface } from '../infra/websocket/interfaces';
import type { RawTcpServerInterface } from '../infra/tcp/interfaces';
import { MessageRouterInterface } from './interfaces';
import { ClientRepositoryInterface, SessionRepositoryInterface, TreeRepositoryInterface, TickRepositoryInterface, SettingsRepositoryInterface } from '../domain/interfaces';
import type { AgentConnectionRegistryInterface, CommandBrokerInterface, DomainEventDispatcherInterface } from '../app/interfaces';
import { StudioServerConfig } from '../configuration';

export interface InfrastructureClients {
    knex: Knex;
}

export interface InfrastructureServices {
    wsServer: WebSocketServerInterface;
    tcpServer: RawTcpServerInterface;
    messageRouter: MessageRouterInterface;
    eventDispatcher: DomainEventDispatcherInterface;
}

export interface AppServices {
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
    AppServices &
    RepositoryServices & {
        config: StudioServerConfig;
    };
