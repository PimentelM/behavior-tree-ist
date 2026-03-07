import { TcpBinaryTransport } from '@bt-studio/studio-transport/node';
import { defineStudioServerE2ETests } from './transport-test-suite';
import { deserializeJsonTransportMessage, serializeMessageAsBinaryJson } from './json-codec';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (TCP binary)',
    createTransportFactory: (service) =>
        TcpBinaryTransport.createFactory(service.tcpHost, service.tcpPort),
    serialize: serializeMessageAsBinaryJson,
    deserialize: deserializeJsonTransportMessage,
});
