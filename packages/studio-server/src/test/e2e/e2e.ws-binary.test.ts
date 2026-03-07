import { WsNodeBinaryTransport } from '@bt-studio/studio-transport/node';
import { defineStudioServerE2ETests } from './transport-test-suite';
import { deserializeJsonTransportMessage, serializeMessageAsBinaryJson } from './json-codec';

defineStudioServerE2ETests({
    name: 'Studio Server E2E (WS binary)',
    createTransportFactory: (service) => WsNodeBinaryTransport.createFactory(service.wsUrl),
    serialize: serializeMessageAsBinaryJson,
    deserialize: deserializeJsonTransportMessage,
});
