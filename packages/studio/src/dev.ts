import { spawn } from 'node:child_process';
import { startMockAgent } from './mock-agent';
import { StudioServer } from './server/server';

type DevOptions = {
  studioHost: string;
  studioPort: number;
  vitePort: number;
  tickRateMs: number;
};

function parseArgs(argv: string[]): DevOptions {
  const options: DevOptions = {
    studioHost: process.env.STUDIO_HOST ?? '0.0.0.0',
    studioPort: Number(process.env.STUDIO_PORT ?? 3210),
    vitePort: Number(process.env.VITE_PORT ?? 3000),
    tickRateMs: Number(process.env.MOCK_AGENT_TICK_MS ?? 20),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--studio-port' && next) {
      options.studioPort = Number(next);
      i++;
      continue;
    }

    if (arg === '--vite-port' && next) {
      options.vitePort = Number(next);
      i++;
      continue;
    }

    if (arg === '--studio-host' && next) {
      options.studioHost = next;
      i++;
      continue;
    }

    if (arg === '--tick-ms' && next) {
      options.tickRateMs = Number(next);
      i++;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const studioServer = new StudioServer({
    host: options.studioHost,
    uiPort: options.studioPort,
  });

  await studioServer.start();

  const agentServerUrl = `ws://127.0.0.1:${options.studioPort}/api/agent/ws`;
  const runningMockAgent = await startMockAgent({
    serverUrl: agentServerUrl,
    tickRateMs: options.tickRateMs,
    clientName: 'Studio Dev Mock Agent',
  });

  const viteStudioServerUrl = `http://127.0.0.1:${options.studioPort}`;
  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const viteChild = spawn(yarnCmd, ['vite', '--host', '--port', String(options.vitePort)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_STUDIO_SERVER_URL: viteStudioServerUrl,
    },
  });

  console.log(`[studio:dev] Studio server: ${viteStudioServerUrl}`);
  console.log(`[studio:dev] Mock agent target: ${agentServerUrl}`);
  console.log(`[studio:dev] Vite UI: http://127.0.0.1:${options.vitePort}`);

  let shuttingDown = false;
  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    runningMockAgent.stop();
    await studioServer.stop();

    if (!viteChild.killed) {
      viteChild.kill('SIGTERM');
    }

    process.exit(exitCode);
  };

  viteChild.on('exit', (code) => {
    void shutdown(code ?? 0);
  });

  process.on('SIGINT', () => {
    void shutdown(0);
  });

  process.on('SIGTERM', () => {
    void shutdown(0);
  });
}

main().catch((error) => {
  console.error('[studio:dev] failed to start', error);
  process.exit(1);
});
