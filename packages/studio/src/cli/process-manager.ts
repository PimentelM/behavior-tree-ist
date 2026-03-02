import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export class ProcessManager {
    private processes: ChildProcess[] = [];

    public startViteServer(port: number, host: string, serverUrl?: string): void {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const studioRoot = join(__dirname, '../../..');

        console.log(`[process-manager] Starting Vite API server on ${host}:${port}...`);
        if (serverUrl) {
            console.log(`[process-manager] Studio server URL: ${serverUrl}`);
        }

        const childEnv = { ...process.env };
        if (serverUrl) {
            childEnv['VITE_STUDIO_SERVER_URL'] = serverUrl;
        }

        // We use npx to ensure we resolve local bin scripts reliably
        const viteProcess = spawn('npx', ['vite', '--port', port.toString(), '--host', host], {
            cwd: studioRoot,
            stdio: 'inherit',
            shell: true,
            env: childEnv,
        });

        viteProcess.on('error', (err) => {
            console.error('[process-manager] Vite failed to start', err);
        });

        this.processes.push(viteProcess);
    }

    public stopAll(): void {
        console.log('\n[process-manager] Stopping all child processes...');
        for (const proc of this.processes) {
            if (!proc.killed) {
                proc.kill('SIGINT');
            }
        }
    }

    public setupSigint(onShutdown: () => void): void {
        process.on('SIGINT', () => {
            onShutdown();
            this.stopAll();
            process.exit(0);
        });
    }
}
