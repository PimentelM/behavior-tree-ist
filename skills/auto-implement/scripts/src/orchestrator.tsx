import { BT } from '@bt-studio/core/tsx';
import {
    BehaviourTree,
    NodeResult,
    ref,
    TreeRegistry,
    StudioLink,
    StudioAgent,
} from '@bt-studio/core';
import type { TickContext, CancellationSignal } from '@bt-studio/core';
import { runClaude, runShellAsync } from './claude-runner.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ── CLI Args ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function getArg(name: string, fallback: string): string {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const workspacePath = path.resolve(getArg('workspace', '.claude/auto-implement'));
const requestFile = path.resolve(getArg('request', path.join(workspacePath, 'request.md')));
const studioUrl = getArg('studio-url', 'ws://localhost:4100/ws');
const skillDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const promptsDir = path.join(skillDir, 'references', 'prompts');
const projectDir = process.cwd();

// ── State (traceable Refs for BT Studio visualization) ───────────────────────

const phase = ref<string>('init', 'phase');
const currentTaskIdx = ref<number>(0, 'currentTaskIdx');
const totalTasks = ref<number>(0, 'totalTasks');
const currentTaskName = ref<string>('', 'currentTaskName');
const attemptNum = ref<number>(0, 'attempt');
const lastError = ref<string>('', 'lastError');

interface Task {
    id: number;
    name: string;
    file: string;
    done: boolean;
}

const tasks = ref<Task[]>([], 'tasks');
const validationCmds = ref<string[]>([], 'validationCmds');

// Base commit hash — tracked at setup for accurate diffs in review
let baseCommitHash = '';

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg: string) {
    const ts = new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(path.join(workspacePath, 'logs', 'orchestrator.log'), line + '\n');
    } catch { /* workspace may not exist yet */ }
}

function writeStatus() {
    fs.writeFileSync(
        path.join(workspacePath, 'status.json'),
        JSON.stringify({
            phase: phase.value,
            totalTasks: totalTasks.value,
            currentTaskIdx: currentTaskIdx.value,
            currentTaskName: currentTaskName.value,
            attempt: attemptNum.value,
            lastError: lastError.value,
            tasks: tasks.value,
        }, null, 2),
    );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectValidationCommands(): string[] {
    const cmds: string[] = [];
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
        if (pkg.scripts?.typecheck) cmds.push('yarn typecheck');
        if (pkg.scripts?.lint) cmds.push('yarn lint');
        if (pkg.scripts?.test) cmds.push('yarn test');
    } catch { /* no package.json or parse error */ }
    return cmds;
}

// ── Actions ──────────────────────────────────────────────────────────────────

function setup(ctx: TickContext): NodeResult {
    phase.set('setup', ctx);
    log('Setting up workspace...');

    for (const dir of ['context', 'plan/tasks', 'logs', 'errors']) {
        fs.mkdirSync(path.join(workspacePath, dir), { recursive: true });
    }

    const cmds = detectValidationCommands();
    validationCmds.set(cmds, ctx);
    log(`Validation commands: ${cmds.join(', ') || 'none'}`);

    if (!fs.existsSync(requestFile)) {
        log('ERROR: Request file not found: ' + requestFile);
        return NodeResult.Failed;
    }

    // Record base commit for accurate diffs during review
    try {
        baseCommitHash = execSync('git rev-parse HEAD', { cwd: projectDir, encoding: 'utf-8' }).trim();
        log(`Base commit: ${baseCommitHash.slice(0, 8)}`);
    } catch {
        log('WARNING: Not a git repo or git unavailable');
    }

    writeStatus();
    return NodeResult.Succeeded;
}

async function explore(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult> {
    phase.set('explore', ctx);
    log('Phase: Explore');
    writeStatus();

    const request = fs.readFileSync(requestFile, 'utf-8');

    const result = await runClaude({
        systemPromptFile: path.join(promptsDir, 'explorer.md'),
        appendSystemPrompt: [
            `Project directory: ${projectDir}`,
            `Write findings to: ${path.join(workspacePath, 'context', 'exploration.md')}`,
            `Write summary to: ${path.join(workspacePath, 'context', 'summary.md')}`,
        ].join('\n'),
        prompt: request,
        maxTurns: 30,
        signal,
        cwd: projectDir,
    });

    log(`Explore done (exit ${result.exitCode})`);
    fs.writeFileSync(path.join(workspacePath, 'logs', 'explore.log'), result.stdout + '\n' + result.stderr);

    return result.exitCode === 0 ? NodeResult.Succeeded : NodeResult.Failed;
}

async function plan(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult> {
    phase.set('plan', ctx);
    log('Phase: Plan');
    writeStatus();

    const request = fs.readFileSync(requestFile, 'utf-8');
    const explorationFile = path.join(workspacePath, 'context', 'exploration.md');
    const exploration = fs.existsSync(explorationFile) ? fs.readFileSync(explorationFile, 'utf-8') : '';

    const result = await runClaude({
        systemPromptFile: path.join(promptsDir, 'planner.md'),
        appendSystemPrompt: [
            `Project directory: ${projectDir}`,
            `Write overall plan to: ${path.join(workspacePath, 'plan', 'plan.md')}`,
            `Write task files to: ${path.join(workspacePath, 'plan', 'tasks')}/ (as 01-name.md, 02-name.md, ...)`,
            `Validation commands available: ${validationCmds.value.join(', ') || 'none detected'}`,
        ].join('\n'),
        prompt: `## Original Request\n\n${request}\n\n## Exploration Findings\n\n${exploration}`,
        maxTurns: 40,
        signal,
        cwd: projectDir,
    });

    log(`Plan done (exit ${result.exitCode})`);
    fs.writeFileSync(path.join(workspacePath, 'logs', 'plan.log'), result.stdout + '\n' + result.stderr);

    return result.exitCode === 0 ? NodeResult.Succeeded : NodeResult.Failed;
}

function loadTasks(ctx: TickContext): NodeResult {
    const tasksDir = path.join(workspacePath, 'plan', 'tasks');
    if (!fs.existsSync(tasksDir)) {
        log('ERROR: No tasks directory');
        return NodeResult.Failed;
    }

    const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md')).sort();
    if (files.length === 0) {
        log('ERROR: No task files found');
        return NodeResult.Failed;
    }

    const loaded: Task[] = files.map((f, i) => ({
        id: i,
        name: f.replace(/^\d+-/, '').replace(/\.md$/, ''),
        file: path.join(tasksDir, f),
        done: false,
    }));

    tasks.set(loaded, ctx);
    totalTasks.set(loaded.length, ctx);
    currentTaskIdx.set(0, ctx);

    log(`Loaded ${loaded.length} tasks: ${loaded.map(t => t.name).join(', ')}`);
    writeStatus();
    return NodeResult.Succeeded;
}

function prepareTask(ctx: TickContext): NodeResult {
    const task = tasks.value[currentTaskIdx.value];
    currentTaskName.set(task.name, ctx);
    attemptNum.set(0, ctx);
    lastError.set('', ctx);

    // Clear previous error file for this task
    const errorFile = path.join(workspacePath, 'errors', `task-${task.id}-errors.md`);
    if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);

    log(`--- Task ${currentTaskIdx.value + 1}/${totalTasks.value}: ${task.name} ---`);
    writeStatus();
    return NodeResult.Succeeded;
}

async function implement(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult> {
    phase.set('implement', ctx);
    const task = tasks.value[currentTaskIdx.value];
    const att = attemptNum.value + 1;
    attemptNum.set(att, ctx);

    log(`Implementing: ${task.name} (attempt ${att})`);
    writeStatus();

    const taskContent = fs.readFileSync(task.file, 'utf-8');
    const planFile = path.join(workspacePath, 'plan', 'plan.md');
    const planContent = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf-8') : '';

    const errorFile = path.join(workspacePath, 'errors', `task-${task.id}-errors.md`);
    const previousErrors = fs.existsSync(errorFile) ? fs.readFileSync(errorFile, 'utf-8') : '';

    let prompt = `## Task\n\n${taskContent}\n\n## Overall Plan\n\n${planContent}`;
    if (previousErrors) {
        prompt += `\n\n## Errors from Previous Attempt (MUST FIX)\n\n${previousErrors}`;
    }

    const result = await runClaude({
        systemPromptFile: path.join(promptsDir, 'worker.md'),
        appendSystemPrompt: [
            `Project directory: ${projectDir}`,
            `Attempt ${att} for this task.`,
            previousErrors ? 'Previous attempt had errors — focus on fixing them.' : '',
        ].filter(Boolean).join('\n'),
        prompt,
        maxTurns: 50,
        signal,
        cwd: projectDir,
    });

    log(`Implement done (exit ${result.exitCode})`);
    fs.writeFileSync(
        path.join(workspacePath, 'logs', `implement-t${task.id}-a${att}.log`),
        result.stdout + '\n' + result.stderr,
    );

    return result.exitCode === 0 ? NodeResult.Succeeded : NodeResult.Failed;
}

async function validate(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult> {
    phase.set('validate', ctx);
    const task = tasks.value[currentTaskIdx.value];

    log(`Validating: ${task.name}`);
    writeStatus();

    const cmds = validationCmds.value;
    if (cmds.length === 0) {
        log('No validation commands, skipping');
        return NodeResult.Succeeded;
    }

    const errors: string[] = [];

    for (const cmd of cmds) {
        if (signal.aborted) return NodeResult.Failed;

        log(`  Running: ${cmd}`);
        const result = await runShellAsync(cmd, projectDir, signal);

        if (result.exitCode !== 0) {
            errors.push(`### \`${cmd}\`\n\n\`\`\`\n${result.output.slice(-4000)}\n\`\`\``);
            log(`  FAILED: ${cmd}`);
        } else {
            log(`  PASSED: ${cmd}`);
        }
    }

    if (errors.length > 0) {
        const errorContent = `# Validation Errors\n\n${errors.join('\n\n')}`;
        fs.writeFileSync(
            path.join(workspacePath, 'errors', `task-${task.id}-errors.md`),
            errorContent,
        );
        lastError.set('Validation failed', ctx);
        writeStatus();
        return NodeResult.Failed;
    }

    log('All validations passed');
    return NodeResult.Succeeded;
}

async function review(ctx: TickContext, signal: CancellationSignal): Promise<NodeResult> {
    phase.set('review', ctx);
    const task = tasks.value[currentTaskIdx.value];

    log(`Reviewing: ${task.name}`);
    writeStatus();

    const taskContent = fs.readFileSync(task.file, 'utf-8');

    // Grab git diff against the base commit (before orchestrator started)
    let diff = '';
    try {
        const diffCmd = baseCommitHash ? `git diff ${baseCommitHash}` : 'git diff HEAD';
        const diffResult = await runShellAsync(diffCmd, projectDir);
        diff = diffResult.output;
    } catch { /* no git or no changes */ }

    const errorFile = path.join(workspacePath, 'errors', `task-${task.id}-errors.md`);

    // Clear previous error file — reviewer writes a new one only if issues found
    if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);

    const result = await runClaude({
        systemPromptFile: path.join(promptsDir, 'reviewer.md'),
        appendSystemPrompt: [
            `Project directory: ${projectDir}`,
            `If issues found, write them to: ${errorFile}`,
            `If implementation is correct, do NOT create that file.`,
        ].join('\n'),
        prompt: `## Task Requirements\n\n${taskContent}\n\n## Changes (git diff)\n\n\`\`\`diff\n${diff.slice(-8000)}\n\`\`\``,
        disallowedTools: ['Edit'],
        maxTurns: 20,
        signal,
        cwd: projectDir,
    });

    log(`Review done (exit ${result.exitCode})`);
    fs.writeFileSync(
        path.join(workspacePath, 'logs', `review-t${task.id}.log`),
        result.stdout + '\n' + result.stderr,
    );

    // Check if reviewer created an error file
    if (fs.existsSync(errorFile)) {
        const content = fs.readFileSync(errorFile, 'utf-8').trim();
        if (content.length > 0) {
            lastError.set('Review found issues', ctx);
            writeStatus();
            return NodeResult.Failed;
        }
    }

    return NodeResult.Succeeded;
}

function completeTask(ctx: TickContext): NodeResult {
    const idx = currentTaskIdx.value;
    const updated = [...tasks.value];
    updated[idx] = { ...updated[idx], done: true };
    tasks.set(updated, ctx);

    const errorFile = path.join(workspacePath, 'errors', `task-${updated[idx].id}-errors.md`);
    if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);

    // Git checkpoint after each completed task
    try {
        execSync('git add -A', { cwd: projectDir });
        execSync(
            `git commit -m "auto-implement: complete task ${idx + 1}/${totalTasks.value} — ${updated[idx].name}"`,
            { cwd: projectDir, encoding: 'utf-8' },
        );
        log(`Git checkpoint: task ${idx + 1}`);
    } catch {
        log('Git commit skipped (no changes or not a git repo)');
    }

    currentTaskIdx.set(idx + 1, ctx);

    log(`Completed: ${updated[idx].name}`);
    writeStatus();
    return NodeResult.Succeeded;
}

function finalize(ctx: TickContext): NodeResult {
    phase.set('done', ctx);

    const completed = tasks.value.filter(t => t.done).length;
    const summary = [
        '# Auto-Implement Summary',
        '',
        `**Status**: ${completed === totalTasks.value ? 'All tasks completed' : `${completed}/${totalTasks.value} completed`}`,
        '',
        '## Tasks',
        ...tasks.value.map(t => `- [${t.done ? 'x' : ' '}] ${t.name}`),
    ].join('\n');

    fs.writeFileSync(path.join(workspacePath, 'summary.md'), summary);
    writeStatus();

    log('All tasks completed!');
    return NodeResult.Succeeded;
}

// ── Behavior Tree ────────────────────────────────────────────────────────────

const root = (
    <sequence-with-memory name="AutoImplement">
        <action name="Setup" execute={setup} />

        <async-action name="Explore" execute={explore} timeout={300_000} />
        <async-action name="Plan" execute={plan} timeout={600_000} />
        <action name="LoadTasks" execute={loadTasks} />

        {/* KeepRunningUntilFailure: loops while child Succeeds, returns Succeeded when child Fails.
            When HasTasks fails (no more tasks), the inner sequence fails,
            KeepRunningUntilFailure converts that to Succeeded, and the parent continues to Finalize.
            No forceSuccess needed — it would create an infinite loop (decorator order: ForceSuccess inner, KRUUF outer). */}
        <sequence-with-memory name="TaskLoop" keepRunningUntilFailure>
            <condition name="HasTasks" eval={() => currentTaskIdx.value < tasks.value.length} />
            <action name="PrepareTask" execute={prepareTask} />

            {/* SequenceWithMemory: after Implement succeeds, resumes from Validate (not re-entering Implement).
                Retry resets the memory on failure, so retries start from Implement again — correct. */}
            <sequence-with-memory name="ImplementAndValidate" retry={5}>
                <async-action name="Implement" execute={implement} timeout={600_000} />
                <async-action name="Validate" execute={validate} timeout={300_000} />
                <async-action name="Review" execute={review} timeout={300_000} />
            </sequence-with-memory>

            <action name="CompleteTask" execute={completeTask} />
        </sequence-with-memory>

        <action name="Finalize" execute={finalize} />
    </sequence-with-memory>
);

const tree = new BehaviourTree(root);
tree.enableStateTrace();
tree.enableProfiling();

// ── Studio Connection (optional, silent on failure) ──────────────────────────

async function tryConnectStudio(): Promise<StudioAgent | null> {
    try {
        const { WsNodeStringTransport } = await import('@bt-studio/studio-transport/node');

        const registry = new TreeRegistry();
        registry.register('auto-implement', tree);

        const link = new StudioLink({
            createTransport: WsNodeStringTransport.createFactory(studioUrl),
        });

        const agent = new StudioAgent({
            clientId: 'auto-implement',
            sessionId: `auto-impl-${Date.now()}`,
            registry,
            link,
        });

        agent.start();
        log(`Studio connected: ${studioUrl}`);
        return agent;
    } catch {
        log('Studio not available — running headless');
        return null;
    }
}

// ── Tick Loop ────────────────────────────────────────────────────────────────

async function main() {
    log('=== Auto-Implement Orchestrator ===');
    log(`Workspace: ${workspacePath}`);
    log(`Request:   ${requestFile}`);
    log(`Project:   ${projectDir}`);
    log(`Prompts:   ${promptsDir}`);

    const studioAgent = await tryConnectStudio();

    const TICK_MS = 1000;

    const tickLoop = setInterval(() => {
        const record = tree.tick({ now: Date.now() });
        studioAgent?.tick();

        // The root node traces last, so the final event is the root's result
        const rootEvent = record.events[record.events.length - 1];
        if (rootEvent && rootEvent.result !== NodeResult.Running) {
            clearInterval(tickLoop);
            studioAgent?.destroy();

            if (rootEvent.result === NodeResult.Succeeded) {
                log('=== SUCCESS ===');
                process.exit(0);
            } else {
                log('=== FAILED ===');
                process.exit(1);
            }
        }
    }, TICK_MS);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
