import { spawn, type ChildProcess } from 'node:child_process';

type DevOptions = {
  studioHost: string;
  studioPort: number;
  vitePort: number;
};

type RunningChild = {
  name: string;
  child: ChildProcess;
};

function parseArgs(argv: string[]): DevOptions {
  const options: DevOptions = {
    studioHost: process.env.STUDIO_HOST ?? '0.0.0.0',
    studioPort: Number(process.env.STUDIO_PORT ?? 3210),
    vitePort: Number(process.env.VITE_PORT ?? 3000),
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
    }
  }

  return options;
}

function waitForExit(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => {
      resolve();
    });
  });
}

function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  const pid = child.pid;
  if (!pid) {
    return;
  }

  try {
    if (process.platform !== 'win32') {
      process.kill(-pid, signal);
      return;
    }
  } catch {
    // Fall through to direct process signaling.
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore: process already exited.
  }
}

async function terminateChildren(children: RunningChild[]): Promise<void> {
  for (const child of children) {
    signalProcessTree(child.child, 'SIGTERM');
  }

  await Promise.race([
    Promise.all(children.map((entry) => waitForExit(entry.child))),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);

  for (const child of children) {
    if (child.child.exitCode !== null || child.child.signalCode !== null) {
      continue;
    }
    signalProcessTree(child.child, 'SIGKILL');
  }
}

function spawnChild(name: string, args: string[], env: NodeJS.ProcessEnv): RunningChild {
  const yarnCmd = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const child = spawn(yarnCmd, args, {
    stdio: 'inherit',
    env,
    detached: process.platform !== 'win32',
  });
  return { name, child };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const studioServerUrl = `http://127.0.0.1:${options.studioPort}`;

  const children: RunningChild[] = [
    spawnChild(
      'studio-server',
      [
        'run',
        'dev:server',
        '--host',
        options.studioHost,
        '--ui-port',
        String(options.studioPort),
      ],
      process.env,
    ),
    spawnChild(
      'studio-ui',
      [
        'run',
        'dev:ui',
        '--host',
        '--port',
        String(options.vitePort),
      ],
      {
        ...process.env,
        VITE_STUDIO_SERVER_URL: studioServerUrl,
      },
    ),
  ];

  console.log(`[studio:dev] Studio server: ${studioServerUrl}`);
  console.log(`[studio:dev] Vite UI: http://127.0.0.1:${options.vitePort}`);
  console.log('[studio:dev] Mock agent is not auto-started. Run `yarn studio:mock-agent` separately when needed.');

  let shuttingDown = false;

  const shutdown = async (exitCode: number) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await terminateChildren(children);
    process.exit(exitCode);
  };

  for (const { name, child } of children) {
    child.once('error', (error) => {
      console.error(`[studio:dev] ${name} failed to start`, error);
      void shutdown(1);
    });

    child.once('exit', (code, signal) => {
      if (shuttingDown) {
        return;
      }
      const description = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      console.error(`[studio:dev] ${name} exited unexpectedly (${description})`);
      void shutdown(code && code !== 0 ? code : 1);
    });
  }

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
