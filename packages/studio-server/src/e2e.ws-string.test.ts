import { WsNodeStringTransport } from '@behavior-tree-ist/studio-transport/node';
import { defineStudioServerE2ETests } from './e2e/transport-test-suite';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (WS string)',
    createTransportFactory: (service) => WsNodeStringTransport.createFactory(service.wsUrl),
});
