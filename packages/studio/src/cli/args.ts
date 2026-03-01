export interface CliArgs {
    server: boolean;
    ui: boolean;
    mockClient: boolean;
    host: string;
    port: number;
    uiPort: number;
}

export function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = {
        server: false,
        ui: false,
        mockClient: false,
        host: '127.0.0.1',
        port: 3000,
        uiPort: 5173,
    };

    let hasExplicitFlags = false;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--server') {
            args.server = true;
            hasExplicitFlags = true;
        } else if (arg === '--ui') {
            args.ui = true;
            hasExplicitFlags = true;
        } else if (arg === '--mock-client') {
            args.mockClient = true;
            hasExplicitFlags = true;
        } else if (arg === '--demo') {
            args.server = true;
            args.ui = true;
            args.mockClient = true;
            hasExplicitFlags = true;
        } else if (arg === '--host' && i + 1 < argv.length) {
            args.host = argv[++i];
        } else if (arg === '--port' && i + 1 < argv.length) {
            args.port = parseInt(argv[++i], 10);
        } else if (arg === '--ui-port' && i + 1 < argv.length) {
            args.uiPort = parseInt(argv[++i], 10);
        }
    }

    // Default: no mode flags -> --server --ui
    if (!hasExplicitFlags) {
        args.server = true;
        args.ui = true;
    }

    return args;
}
