import { startMockAgent } from './mock-agent';

type CliOptions = {
  serverUrl: string;
  tickRateMs?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    serverUrl: 'ws://127.0.0.1:3000/api/agent/ws',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--server-url' && next) {
      options.serverUrl = next;
      i++;
      continue;
    }

    if (arg === '--tick-ms' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.tickRateMs = parsed;
      }
      i++;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const running = await startMockAgent({
    serverUrl: options.serverUrl,
    tickRateMs: options.tickRateMs,
  });

  console.log(`[mock-agent] connected/retrying at ${options.serverUrl}`);

  const shutdown = () => {
    running.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[mock-agent] failed to start', error);
  process.exit(1);
});
