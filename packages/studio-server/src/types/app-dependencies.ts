import type { Knex } from 'knex';
import { type WebSocketServerInterface } from '../infra/websocket/interfaces';
import { type UiWebSocketServerInterface } from '../infra/websocket/ui-websocket-server';
import type { RawTcpServerInterface } from '../infra/tcp/interfaces';
import { type MessageRouterInterface } from './interfaces';
import { type ClientRepositoryInterface, type SessionRepositoryInterface, type TreeRepositoryInterface, type TickRepositoryInterface, type SettingsRepositoryInterface } from '../domain/interfaces';
import type { AgentConnectionRegistryInterface, UiConnectionRegistryInterface, CommandBrokerInterface, DomainEventDispatcherInterface } from '../app/interfaces';
import { type StudioServerConfig } from '../configuration';

export interface InfrastructureClients {
    knex: Knex;
}

export interface InfrastructureServices {
    wsServer: WebSocketServerInterface;
    uiWsServer: UiWebSocketServerInterface;
    tcpServer: RawTcpServerInterface;
    messageRouter: MessageRouterInterface;
    eventDispatcher: DomainEventDispatcherInterface;
}

export interface AppServices {
    agentConnectionRegistry: AgentConnectionRegistryInterface;
    uiConnectionRegistry: UiConnectionRegistryInterface;
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
