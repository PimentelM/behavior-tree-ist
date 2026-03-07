import { WsNodeStringTransport } from '@bt-studio/studio-transport/node';
import { defineStudioServerE2ETests } from './transport-test-suite';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (WS string)',
    createTransportFactory: (service) => WsNodeStringTransport.createFactory(service.wsUrl),
});
