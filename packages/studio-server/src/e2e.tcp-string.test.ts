import { TcpStringTransport } from '@behavior-tree-ist/studio-transport/node';
import { defineStudioServerE2ETests } from './e2e/transport-test-suite';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (TCP string)',
    createTransportFactory: (service) =>
        TcpStringTransport.createFactory(service.tcpHost, service.tcpPort),
});
