import { TcpBinaryTransport } from '@behavior-tree-ist/studio-transport/node';
import { defineStudioServerE2ETests } from './e2e/transport-test-suite';
import { deserializeJsonTransportMessage, serializeMessageAsBinaryJson } from './e2e/json-codec';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (TCP binary)',
    createTransportFactory: (service) =>
        TcpBinaryTransport.createFactory(service.tcpHost, service.tcpPort),
    serialize: serializeMessageAsBinaryJson,
    deserialize: deserializeJsonTransportMessage,
});
