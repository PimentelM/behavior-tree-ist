import { WsNodeBinaryTransport } from '@behavior-tree-ist/studio-transport/node';
import { defineStudioServerE2ETests } from './e2e/transport-test-suite';
import { deserializeJsonTransportMessage, serializeMessageAsBinaryJson } from './e2e/json-codec';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (WS binary)',
    createTransportFactory: (service) => WsNodeBinaryTransport.createFactory(service.wsUrl),
    serialize: serializeMessageAsBinaryJson,
    deserialize: deserializeJsonTransportMessage,
});
