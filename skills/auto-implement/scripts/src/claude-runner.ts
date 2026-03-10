import { spawn } from 'child_process';
import type { CancellationSignal } from '@bt-studio/core';

export interface RunClaudeOptions {
    systemPromptFile?: string;
    systemPrompt?: string;
    appendSystemPrompt?: string;
    prompt: string;
    allowedTools?: string[];
    disallowedTools?: string[];
    maxTurns?: number;
    signal?: CancellationSignal;
    cwd?: string;
    onOutput?: (line: string) => void;
}

export interface ClaudeResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export function runClaude(options: RunClaudeOptions): Promise<ClaudeResult> {
    return new Promise((resolve, reject) => {
        const args = ['-p'];

        if (options.systemPromptFile) {
            args.push('--system-prompt-file', options.systemPromptFile);
        } else if (options.systemPrompt) {
            args.push('--system-prompt', options.systemPrompt);
        }

        if (options.appendSystemPrompt) {
            args.push('--append-system-prompt', options.appendSystemPrompt);
        }

        if (options.allowedTools?.length) {
            args.push('--allowedTools', options.allowedTools.join(','));
        }

        if (options.disallowedTools?.length) {
            args.push('--disallowedTools', options.disallowedTools.join(','));
        }

        if (options.maxTurns) {
            args.push('--max-turns', String(options.maxTurns));
        }

        args.push('--dangerously-skip-permissions');
        args.push('--no-session-persistence');
        args.push(options.prompt);

        // Strip all Claude Code env vars to avoid nested session interference
        const env = { ...process.env };
        for (const key of Object.keys(env)) {
            if (key === 'CLAUDECODE' || key.startsWith('CLAUDE_CODE_')) {
                delete env[key];
            }
        }

        // Debug: log spawn details
        const cwd = options.cwd || process.cwd();
        console.log('[runClaude] args:', JSON.stringify(args));
        console.log('[runClaude] cwd:', cwd);
        console.log('[runClaude] env keys:', Object.keys(env).sort().join(', '));
        console.log('[runClaude] PATH:', env.PATH);

        const proc = spawn('claude', args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
        });

        console.log('[runClaude] spawned pid:', proc.pid);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stdout += chunk;
            if (options.onOutput) {
                for (const line of chunk.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed) options.onOutput(trimmed);
                }
            }
        });
        proc.stderr.on('data', (data: Buffer) => {
            const chunk = data.toString();
            stderr += chunk;
            if (options.onOutput) {
                for (const line of chunk.split('\n')) {
                    const trimmed = line.trim();
                    if (trimmed) options.onOutput(`[stderr] ${trimmed}`);
                }
            }
        });

        if (options.signal) {
            options.signal.onAbort(() => {
                proc.kill('SIGTERM');
            });
        }

        proc.on('close', (code: number | null, signal: string | null) => {
            console.log(`[runClaude] closed code=${code} signal=${signal} stdout=${stdout.length}B stderr=${stderr.length}B`);
            resolve({ exitCode: code ?? 1, stdout, stderr });
        });

        proc.on('error', (err: Error) => {
            console.log(`[runClaude] error: ${err.message}`);
            resolve({ exitCode: 1, stdout, stderr: stderr + '\nProcess error: ' + err.message });
        });
    });
}

export function runShellAsync(
    cmd: string,
    cwd: string,
    signal?: CancellationSignal,
    timeoutMs = 300_000,
): Promise<{ exitCode: number; output: string }> {
    return new Promise((resolve) => {
        const proc = spawn('sh', ['-c', cmd], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let output = '';
        proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
        proc.stderr.on('data', (d: Buffer) => { output += d.toString(); });

        if (signal) {
            signal.onAbort(() => proc.kill('SIGTERM'));
        }

        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            output += '\n[TIMEOUT]';
        }, timeoutMs);

        proc.on('close', (code: number | null) => {
            clearTimeout(timer);
            resolve({ exitCode: code ?? 1, output });
        });
    });
}
