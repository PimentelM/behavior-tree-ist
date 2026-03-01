import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StudioServer } from './server/server';

type CliOptions = {
  host?: string;
  uiPort?: number;
  uiPushMs?: number;
  maxTicksPerTree?: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--host' && next) {
      options.host = next;
      i++;
      continue;
    }

    if (arg === '--ui-port' && next) {
      options.uiPort = Number(next);
      i++;
      continue;
    }

    if (arg === '--ui-push-ms' && next) {
      options.uiPushMs = Number(next);
      i++;
      continue;
    }

    if (arg === '--max-ticks-per-tree' && next) {
      options.maxTicksPerTree = Number(next);
      i++;
      continue;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packagedStaticDir = join(currentDir, '..', 'ui');
  const workspaceStaticDir = join(process.cwd(), 'packages', 'studio', 'dist', 'ui');
  const staticDir = existsSync(packagedStaticDir) ? packagedStaticDir : workspaceStaticDir;
  const server = new StudioServer({
    host: args.host ?? '0.0.0.0',
    uiPort: args.uiPort ?? 3000,
    uiPushMs: args.uiPushMs,
    maxTicksPerTree: args.maxTicksPerTree,
    staticDir,
  });

  await server.start();

  console.log(`[bt-studio] UI: ${server.getUiUrl()}`);
  console.log(`[bt-studio] Agent listen endpoint: ${server.getAgentListenUrl()}`);
  console.log('[bt-studio] Warning: auth is disabled in v1, avoid exposing this service outside trusted networks.');

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error('[bt-studio] failed to start', error);
  process.exit(1);
});
