import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Readline } from 'xterm-readline';
import '@xterm/xterm/css/xterm.css';
import { replTheme } from './repl-theme';
import { highlightJs } from './js-syntax';
import { useRepl } from './use-repl';
import type { ReplResult, UseReplReturn } from './use-repl';

// ---- ANSI colour helpers ----
const RESET = '\x1b[0m';
const BRIGHT_GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const CYAN = '\x1b[96m';
const GRAY = '\x1b[90m';

const PROMPT = '\x1b[97m> \x1b[0m';

// ---- Syntax highlighter adapter for xterm-readline ----

const jsHighlighter = {
    highlight(line: string): string {
        return highlightJs(line);
    },
    highlightPrompt(prompt: string): string {
        return prompt;
    },
    highlightChar(): boolean {
        // Always re-highlight so syntax colouring stays current as tokens change.
        return true;
    },
};

// ---- write helpers ----

function writeln(rl: Readline, text: string) {
    rl.write(text.replace(/\r?\n/g, '\r\n') + '\r\n');
}

function printResult(rl: Readline, result: ReplResult) {
    const ts = new Date().toLocaleTimeString();
    const pfx = `${GRAY}[${ts}]${RESET} `;
    if (result.consoleOutput && result.consoleOutput.length > 0) {
        for (const line of result.consoleOutput) {
            writeln(rl, pfx + `${CYAN}→ ${line}${RESET}`);
        }
    }
    if (result.kind === 'error') {
        writeln(rl, pfx + `${RED}${result.text}${RESET}`);
    } else {
        writeln(rl, pfx + `${BRIGHT_GREEN}${result.text}${RESET}`);
    }
}

// ---- Key management panel ----

interface KeyManagementProps {
    keyPair: { publicKeyB64: string; privateKeyB64: string } | null;
    onGenerate: () => void;
    onImport: (input: string) => void;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => { setCopied(false); }, 1500);
                });
            }}
            style={{
                background: 'transparent',
                border: '1px solid #333333',
                color: copied ? '#5af78e' : '#888888',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 10,
                padding: '1px 6px',
                flexShrink: 0,
            }}
        >
            {copied ? 'Copied!' : label}
        </button>
    );
}

function KeyRow({ label, value, dimmed, masked }: { label: string; value: string; dimmed?: boolean; masked?: boolean }) {
    const displayValue = masked && value.length > 4 ? value.slice(0, 4) + '•'.repeat(10) : value;
    const titleAttr = masked ? 'Private key (hidden)' : value;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#686868', fontSize: 10, flexShrink: 0 }}>{label}</span>
            <code
                style={{
                    background: '#1a1a1a',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 10,
                    color: dimmed ? '#888888' : '#5af78e',
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flexShrink: 1,
                }}
                title={titleAttr}
            >
                {displayValue}
            </code>
            <CopyButton text={value} />
        </div>
    );
}

function KeyManagement({ keyPair, onGenerate, onImport }: KeyManagementProps) {
    const [importOpen, setImportOpen] = useState(false);
    const [importValue, setImportValue] = useState('');
    const [importError, setImportError] = useState<string | null>(null);

    function handleImport() {
        try {
            onImport(importValue);
            setImportOpen(false);
            setImportValue('');
            setImportError(null);
        } catch (err) {
            setImportError(err instanceof Error ? err.message : String(err));
        }
    }

    return (
        <div
            style={{
                padding: '6px 10px',
                background: '#111111',
                borderTop: '1px solid #333333',
                fontSize: 11,
                fontFamily: 'Menlo, Consolas, monospace',
                color: '#e0e0e0',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ color: '#686868', fontSize: 10, flexShrink: 0 }}>REPL Keys</span>
                {keyPair ? (
                    <>
                        <KeyRow label="pub:" value={keyPair.publicKeyB64} />
                        <KeyRow label="priv:" value={keyPair.privateKeyB64} dimmed masked />
                    </>
                ) : (
                    <span style={{ color: '#ff5c57', fontSize: 10 }}>No keypair set</span>
                )}
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
                    <button
                        onClick={() => { setImportOpen((v) => !v); setImportError(null); }}
                        style={{
                            background: 'transparent',
                            border: '1px solid #333333',
                            color: importOpen ? '#5af78e' : '#888888',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '1px 6px',
                        }}
                    >
                        Import Key
                    </button>
                    <button
                        onClick={onGenerate}
                        style={{
                            background: 'transparent',
                            border: '1px solid #333333',
                            color: '#888888',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '1px 6px',
                        }}
                    >
                        New Keypair
                    </button>
                </div>
            </div>
            {importOpen && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <input
                        placeholder="Paste private key (hex or base64url)"
                        value={importValue}
                        onChange={(e) => { setImportValue(e.target.value); setImportError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
                        style={{
                            flex: 1,
                            background: '#1a1a1a',
                            border: `1px solid ${importError ? '#ff5c57' : '#333333'}`,
                            color: '#e0e0e0',
                            borderRadius: 3,
                            fontSize: 10,
                            padding: '2px 6px',
                            fontFamily: 'Menlo, Consolas, monospace',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleImport}
                        style={{
                            background: 'transparent',
                            border: '1px solid #5af78e',
                            color: '#5af78e',
                            borderRadius: 3,
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '2px 6px',
                        }}
                    >
                        Set
                    </button>
                    {importError && (
                        <span style={{ color: '#ff5c57', fontSize: 10 }}>{importError}</span>
                    )}
                </div>
            )}
        </div>
    );
}

// ---- Completion helpers ----

/**
 * Compute longest common prefix of an array of strings.
 */
function longestCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    let prefix = strings[0] as string;
    for (let i = 1; i < strings.length; i++) {
        while (!(strings[i] as string).startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}

/**
 * Apply a completion candidate to the current input prefix.
 * Replaces the trailing identifier token with `candidate`.
 */
function applyCompletion(prefix: string, candidate: string): string {
    const match = prefix.match(/([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*\.?)$/);
    if (!match) return prefix;
    const lastDot = (match[1] as string).lastIndexOf('.');
    const replacement = lastDot >= 0
        ? (match[1] as string).slice(0, lastDot + 1) + candidate
        : candidate;
    return prefix.slice(0, prefix.length - (match[1] as string).length) + replacement;
}

// Internal readline state accessor (private fields accessed via cast).
type RlState = {
    buffer(): string;
    update(t: string): void;
    refresh(): void;
    moveCursorBack(n: number): void;
    moveCursorForward(n: number): void;
    editBackspace(n: number): void;
    line?: { pos: number; buf: string };
};
type RlInternal = { state?: RlState };

// ---- Word boundary helpers ----

function wordBoundaryLeft(text: string, pos: number): number {
    let i = pos;
    while (i > 0 && !/[a-zA-Z0-9_$]/.test(text.charAt(i - 1))) i--;
    while (i > 0 && /[a-zA-Z0-9_$]/.test(text.charAt(i - 1))) i--;
    return i;
}

function wordBoundaryRight(text: string, pos: number): number {
    let i = pos;
    while (i < text.length && !/[a-zA-Z0-9_$]/.test(text.charAt(i))) i++;
    while (i < text.length && /[a-zA-Z0-9_$]/.test(text.charAt(i))) i++;
    return i;
}

// ---- REPL Terminal ----

interface ReplTerminalProps {
    clientId: string | null;
    sessionId: string | null;
}

export function ReplTerminal({ clientId, sessionId }: ReplTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // replRef allows the stable terminal effect to access current repl without closure staling.
    const replRef = useRef<UseReplReturn | null>(null);

    const repl = useRepl({ clientId, sessionId });
    replRef.current = repl;

    // ---- one-time terminal setup ----
    useEffect(() => {
        if (!containerRef.current) return;

        const term = new Terminal({
            theme: replTheme,
            fontFamily: 'Menlo, Consolas, monospace',
            fontSize: 13,
            lineHeight: 1.2,
            cursorBlink: true,
            cursorStyle: 'block',
            scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        const rl = new Readline();

        term.loadAddon(fitAddon);
        term.loadAddon(rl);
        term.open(containerRef.current);

        fitAddon.fit();
        term.focus();

        rl.setHighlighter(jsHighlighter);

        // After loadAddon, override the custom key handler so we can intercept
        // Tab (completions) and Shift+Enter (multi-line continuation).
        // readline's own handler only blocks Shift+Enter; we replace it.
        term.attachCustomKeyEventHandler((ev) => {
            // Shift+Enter: send Alt+Enter sequence (\x1b\r) which readline
            // treats as AltEnter → editInsert("\n"), same as its native ShiftEnter.
            if (ev.key === 'Enter' && ev.shiftKey) {
                if (ev.type === 'keydown') {
                    term.input('\x1b\r', true);
                }
                return false;
            }
            // Tab / Ctrl+Space: trigger async completions, suppress \t.
            // preventDefault() is required to prevent the browser from moving focus
            // to the next focusable element outside the xterm canvas.
            if (ev.type === 'keydown' && (ev.key === 'Tab' || (ev.ctrlKey && ev.key === ' '))) {
                ev.preventDefault();
                void handleTab();
                return false;
            }
            // Alt+Left: move cursor back one word
            if (ev.type === 'keydown' && ev.altKey && ev.key === 'ArrowLeft') {
                const st = (rl as unknown as RlInternal).state;
                if (st?.line) {
                    const target = wordBoundaryLeft(st.line.buf, st.line.pos);
                    const delta = st.line.pos - target;
                    if (delta > 0) st.moveCursorBack(delta);
                }
                return false;
            }
            // Alt+Right: move cursor forward one word
            if (ev.type === 'keydown' && ev.altKey && ev.key === 'ArrowRight') {
                const st = (rl as unknown as RlInternal).state;
                if (st?.line) {
                    const target = wordBoundaryRight(st.line.buf, st.line.pos);
                    const delta = target - st.line.pos;
                    if (delta > 0) st.moveCursorForward(delta);
                }
                return false;
            }
            // Alt+Backspace: delete previous word
            if (ev.type === 'keydown' && ev.altKey && ev.key === 'Backspace') {
                const st = (rl as unknown as RlInternal).state;
                if (st?.line) {
                    const target = wordBoundaryLeft(st.line.buf, st.line.pos);
                    const delta = st.line.pos - target;
                    if (delta > 0) st.editBackspace(delta);
                }
                return false;
            }
            return true;
        });

        async function handleTab() {
            const r = replRef.current;
            if (!r) return;

            const rlInternal = rl as unknown as RlInternal;
            const rlState = rlInternal.state;
            if (!rlState) {
                // eslint-disable-next-line no-console
                console.warn('[REPL] Tab: readline state not available');
                return;
            }

            const prefix = rlState.buffer();
            if (!prefix) return; // nothing to complete

            try {
                const completions = await r.sendCompletions(prefix);
                if (completions.length === 0) return;

                // Re-check after async gap — discard if buffer changed.
                const currentState = rlInternal.state;
                if (currentState?.buffer() !== prefix) return;

                if (completions.length === 1) {
                    currentState.update(applyCompletion(prefix, completions[0] as string));
                } else {
                    // Multiple matches: apply longest common prefix.
                    const lcp = longestCommonPrefix(completions);
                    const completed = applyCompletion(prefix, lcp);
                    if (completed !== prefix) {
                        currentState.update(completed);
                    } else {
                        // LCP didn't narrow further — display candidate list below the
                        // current prompt line (bash/Frida double-tab style), then restore
                        // the readline prompt by moving the cursor back up and refreshing.
                        const candidatesStr = completions.join('  ');
                        rl.write(`\r\n${GRAY}${candidatesStr}${RESET}\r\n`);
                        rl.write('\x1b[2A\r');
                        currentState.refresh();
                    }
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[REPL] Tab completion error:', err);
            }
        }

        async function doEval(code: string) {
            if (!code.trim()) return;

            const r = replRef.current;
            if (!r) {
                writeln(rl, `${RED}REPL not ready${RESET}`);
                return;
            }

            rl.write(`${GRAY}…${RESET}`);

            try {
                const result = await r.sendEval(code);
                rl.write('\r\x1b[K');
                printResult(rl, result);
            } catch (err) {
                rl.write('\r\x1b[K');
                writeln(rl, `${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
            }
        }

        writeln(rl, `\x1b[97mWelcome to BT Studio REPL${RESET}`);
        writeln(rl, `${GRAY}Type JavaScript and press Enter. Tab for completions. Shift+Enter for multi-line.${RESET}`);

        async function readLoop() {
            for (;;) {
                try {
                    const line = await rl.read(PROMPT);
                    await doEval(line);
                } catch {
                    // Ctrl+C aborts the pending read — re-prompt on next iteration.
                }
            }
        }

        void readLoop();

        const ro = new ResizeObserver(() => { fitAddon.fit(); });
        ro.observe(containerRef.current);

        return () => {
            ro.disconnect();
            term.dispose();
        };
    }, []); // intentionally empty — terminal created once; handlers use replRef

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
            <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
            <KeyManagement
                keyPair={repl.keyPair}
                onGenerate={repl.generateKeyPair}
                onImport={repl.importPrivateKey}
            />
        </div>
    );
}
