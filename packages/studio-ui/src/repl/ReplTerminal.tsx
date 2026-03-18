import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Readline } from 'xterm-readline';
import '@xterm/xterm/css/xterm.css';
import { replTheme } from './repl-theme';
import { highlightJs, highlightJsHtml } from './js-syntax';
import { useRepl } from './use-repl';
import type { ReplResult, UseReplReturn } from './use-repl';
import { useReplMonitor } from './use-repl-monitor';
import type { ReplActivityEntry } from './use-repl-monitor';
import { CompletionOverlay } from './CompletionOverlay';
import { useUiWebSocket } from '../use-ui-websocket';

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
    highlightChar(line: string, pos: number): boolean {
        // Trigger a full re-highlight only for non-word characters (operators,
        // punctuation, whitespace).  Word characters (letters, digits, _, $)
        // use xterm-readline's optimised single-write fast path, avoiding the
        // xterm WriteBuffer _didUserInput flicker: the optimisation processes
        // only the *first* write after user input immediately and defers the
        // rest to setTimeout, briefly exposing the cleared line between writes.
        if (pos <= 0) return false;
        const ch = line[pos - 1];
        return ch !== undefined && !/[a-zA-Z0-9_$]/.test(ch);
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

// ---- Monitor Entry ----

function MonitorEntry({ entry }: { entry: ReplActivityEntry }) {
    const ts = new Date(entry.timestamp).toLocaleTimeString();
    return (
        <div style={{ marginBottom: 8, fontFamily: 'Menlo, Consolas, monospace', fontSize: 12 }}>
            <div>
                <span style={{ color: '#686868' }}>[{ts}]</span>
                <span style={{ color: '#888888' }}> {'>'} </span>
                <span dangerouslySetInnerHTML={{ __html: highlightJsHtml(entry.code) }} />
            </div>
            {entry.result.consoleOutput?.map((line, j) => (
                <div key={j} style={{ paddingLeft: 16, color: '#56b6c2' }}>
                    {'\u2192'} {line}
                </div>
            ))}
            <div style={{ paddingLeft: 16, color: entry.result.kind === 'error' ? '#ff5c57' : '#5af78e' }}>
                {'\u2190'} {entry.result.text}
            </div>
        </div>
    );
}

// ---- REPL Terminal ----

interface ReplTerminalProps {
    clientId: string | null;
    sessionId: string | null;
}

type CompletionState = {
    candidates: string[];
    selectedIndex: number;
    prefix: string;
    rlState: RlState;
    x: number;
    y: number;
};

export function ReplTerminal({ clientId, sessionId }: ReplTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const rlRef = useRef<Readline | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const monitorBottomRef = useRef<HTMLDivElement>(null);

    // replRef allows the stable terminal effect to access current repl without closure staling.
    const replRef = useRef<UseReplReturn | null>(null);

    const repl = useRepl({ clientId, sessionId });
    replRef.current = repl;

    const [monitorMode, setMonitorMode] = useState(false);
    const subscribe = useUiWebSocket();
    const monitor = useReplMonitor({
        subscribe,
        clientId,
        sessionId,
        sessionKeys: repl.sessionKeys,
        selfSentPayloads: repl.sentEncryptedPayloads,
    });

    // Auto-scroll monitor on new entries
    useEffect(() => {
        monitorBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [monitor.activities.length]);

    // Refit xterm when switching back to interactive mode
    useEffect(() => {
        if (!monitorMode && fitAddonRef.current) {
            fitAddonRef.current.fit();
        }
    }, [monitorMode]);

    // Completion overlay state — bridged from the one-time useEffect via refs.
    const [completionState, setCompletionState] = useState<CompletionState | null>(null);
    const completionStateRef = useRef<CompletionState | null>(null);
    completionStateRef.current = completionState;
    const setCompletionStateRef = useRef(setCompletionState);
    setCompletionStateRef.current = setCompletionState;

    // ---- Textarea button state ----
    const doEvalRef = useRef<((code: string) => Promise<void>) | null>(null);
    const inputPreRef = useRef<HTMLPreElement>(null);
    const outputBufferRef = useRef<string[]>([]);

    const [inputOpen, setInputOpen] = useState(false);
    const [outputOpen, setOutputOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [outputText, setOutputText] = useState('');

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

        termRef.current = term;

        const fitAddon = new FitAddon();
        const rl = new Readline();

        term.loadAddon(fitAddon);
        term.loadAddon(rl);
        term.open(containerRef.current);
        rlRef.current = rl;
        fitAddonRef.current = fitAddon;

        fitAddon.fit();
        term.focus();

        rl.setHighlighter(jsHighlighter);

        // After loadAddon, override the custom key handler so we can intercept
        // Tab (completions) and Shift+Enter (multi-line continuation).
        // readline's own handler only blocks Shift+Enter; we replace it.
        term.attachCustomKeyEventHandler((ev) => {
            // When the completion overlay is open, intercept navigation keys.
            if (completionStateRef.current && ev.type === 'keydown') {
                if (ev.key === 'ArrowDown') {
                    ev.preventDefault();
                    setCompletionStateRef.current((prev) =>
                        prev ? { ...prev, selectedIndex: (prev.selectedIndex + 1) % prev.candidates.length } : null
                    );
                    return false;
                }
                if (ev.key === 'ArrowUp') {
                    ev.preventDefault();
                    setCompletionStateRef.current((prev) =>
                        prev
                            ? { ...prev, selectedIndex: (prev.selectedIndex - 1 + prev.candidates.length) % prev.candidates.length }
                            : null
                    );
                    return false;
                }
                if (ev.key === 'Enter' || ev.key === 'Tab') {
                    ev.preventDefault();
                    const st = completionStateRef.current;
                    const candidate = st.candidates[st.selectedIndex];
                    if (candidate !== undefined) {
                        st.rlState.update(applyCompletion(st.prefix, candidate));
                    }
                    setCompletionStateRef.current(null);
                    return false;
                }
                if (ev.key === 'Escape') {
                    ev.preventDefault();
                    setCompletionStateRef.current(null);
                    return false;
                }
            }
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

        // Dismiss completion overlay when user types (Tab re-triggers completions).
        term.onData(() => {
            if (completionStateRef.current) {
                setCompletionStateRef.current(null);
            }
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
                // Use the pre-await rlState reference: xterm-readline may create a new
                // state object during the async gap, so re-fetching rlInternal.state
                // could silently discard valid completions.
                if (rlState.buffer() !== prefix) return;

                if (completions.length === 1) {
                    rlState.update(applyCompletion(prefix, completions[0] as string));
                } else {
                    // Multiple matches: apply longest common prefix if it narrows.
                    const lcp = longestCommonPrefix(completions);
                    const completed = applyCompletion(prefix, lcp);
                    if (completed !== prefix) {
                        rlState.update(completed);
                    } else {
                        // LCP didn't narrow further — show HTML overlay positioned at cursor.
                        const core = (term as unknown as Record<string, unknown>)._core as Record<string, unknown> | undefined;
                        const dims = (core?._renderService as Record<string, unknown> | undefined)?.dimensions as Record<string, unknown> | undefined;
                        const cellCss = (dims?.css as Record<string, unknown> | undefined)?.cell as Record<string, unknown> | undefined;
                        const cellWidth = typeof cellCss?.width === 'number' ? cellCss.width : 8;
                        const cellHeight = typeof cellCss?.height === 'number' ? cellCss.height : 17;
                        const cursorX = term.buffer.active.cursorX * cellWidth;
                        const cursorY = (term.buffer.active.cursorY + 1) * cellHeight;
                        setCompletionStateRef.current({
                            candidates: completions,
                            selectedIndex: 0,
                            prefix,
                            rlState,
                            x: cursorX,
                            y: cursorY,
                        });
                    }
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[REPL] Tab completion error:', err);
            }
        }

        async function doEval(code: string) {
            if (!code.trim()) return;

            if (/^clear(\(\))?$/.test(code.trim())) {
                term.clear();
                return;
            }

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
                outputBufferRef.current.push('> ' + code);
                if (result.consoleOutput) {
                    for (const line of result.consoleOutput) {
                        outputBufferRef.current.push('→ ' + line);
                    }
                }
                outputBufferRef.current.push(result.text);
            } catch (err) {
                rl.write('\r\x1b[K');
                writeln(rl, `${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
                outputBufferRef.current.push('> ' + code);
                outputBufferRef.current.push('Error: ' + (err instanceof Error ? err.message : String(err)));
            }
        }

        doEvalRef.current = doEval;

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
            termRef.current = null;
            rlRef.current = null;
            fitAddonRef.current = null;
        };
    }, []); // intentionally empty — terminal created once; handlers use refs

    // ---- handshake status feedback ----
    useEffect(() => {
        const rl = rlRef.current;
        if (!rl) return;
        if (repl.handshakeStatus === 'established') {
            writeln(rl, `${GRAY}E2E session established${RESET}`);
        } else if (typeof repl.handshakeStatus === 'object' && 'error' in repl.handshakeStatus) {
            writeln(rl, `${RED}E2E handshake failed: ${repl.handshakeStatus.error}${RESET}`);
        }
    }, [repl.handshakeStatus]);

    const toolBtnStyle: React.CSSProperties = {
        background: 'transparent',
        border: '1px solid #333333',
        color: '#888888',
        borderRadius: 3,
        cursor: 'pointer',
        fontSize: 10,
        padding: '1px 6px',
        fontFamily: 'Menlo, Consolas, monospace',
    };

    const popupStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '100%',
        left: 0,
        background: '#1a1a1a',
        border: '1px solid #333333',
        borderRadius: 6,
        boxShadow: '0 -4px 12px rgba(0,0,0,0.5)',
        padding: 12,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 600,
        maxWidth: '80vw',
    };

    const popupTextareaStyle: React.CSSProperties = {
        background: '#0a0a0a',
        border: '1px solid #333333',
        color: '#e0e0e0',
        borderRadius: 3,
        fontSize: 12,
        padding: '6px 8px',
        fontFamily: 'Menlo, Consolas, monospace',
        resize: 'vertical',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
            {/* Mode toggle bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #222222', background: '#111111' }}>
                <button
                    onClick={() => { setMonitorMode(false); }}
                    style={{ padding: '4px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: !monitorMode ? '#5af78e' : '#686868', fontSize: 12, fontFamily: 'Menlo, Consolas, monospace' }}
                >
                    Interactive
                </button>
                <button
                    onClick={() => { setMonitorMode(true); }}
                    style={{ padding: '4px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: monitorMode ? '#5af78e' : '#686868', fontSize: 12, fontFamily: 'Menlo, Consolas, monospace' }}
                >
                    Monitor
                </button>
                {monitorMode && (
                    <button
                        onClick={monitor.clearActivities}
                        style={{ padding: '4px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#686868', fontSize: 12, fontFamily: 'Menlo, Consolas, monospace', marginLeft: 'auto' }}
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* xterm terminal — hidden in monitor mode */}
            <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', display: monitorMode ? 'none' : 'flex' }}>
                {completionState && (
                    <CompletionOverlay
                        candidates={completionState.candidates}
                        selectedIndex={completionState.selectedIndex}
                        x={completionState.x}
                        y={completionState.y}
                        onSelect={(candidate) => {
                            completionState.rlState.update(applyCompletion(completionState.prefix, candidate));
                            setCompletionState(null);
                            termRef.current?.focus();
                        }}
                        onDismiss={() => { setCompletionState(null); }}
                    />
                )}
            </div>

            {/* Monitor view — hidden in interactive mode */}
            <div style={{ display: monitorMode ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column', background: '#0a0a0a' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                    {monitor.activities.length === 0 && (
                        <div style={{ color: '#686868', fontSize: 11, fontFamily: 'Menlo, Consolas, monospace' }}>No activity yet. Waiting for eval traffic...</div>
                    )}
                    {monitor.activities.map((entry, i) => (
                        <MonitorEntry key={i} entry={entry} />
                    ))}
                    <div ref={monitorBottomRef} />
                </div>
            </div>

            {/* ---- Textarea utility toolbar ---- */}
            <div style={{
                display: 'flex',
                gap: 6,
                padding: '4px 10px',
                background: '#111111',
                borderTop: '1px solid #222222',
                position: 'relative',
                fontFamily: 'Menlo, Consolas, monospace',
            }}>
                {/* Paste Input button + popup */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => { setInputOpen((v) => !v); setOutputOpen(false); }}
                        style={{ ...toolBtnStyle, color: inputOpen ? '#5af78e' : '#888888' }}
                    >
                        Paste Input
                    </button>
                    {inputOpen && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                                onMouseDown={() => { setInputOpen(false); }}
                            />
                            <div
                                style={popupStyle}
                                onKeyDown={(e) => { if (e.key === 'Escape') setInputOpen(false); }}
                            >
                                <span style={{ color: '#686868', fontSize: 10 }}>
                                    Paste multi-line code — Ctrl+Enter to send
                                </span>
                                <div style={{ position: 'relative' }}>
                                    <pre
                                        ref={inputPreRef}
                                        aria-hidden
                                        style={{
                                            ...popupTextareaStyle,
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            margin: 0,
                                            overflow: 'auto',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                            pointerEvents: 'none',
                                            color: '#e0e0e0',
                                            resize: 'none',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: highlightJsHtml(inputValue) + '\n' }}
                                    />
                                    <textarea
                                        autoFocus
                                        rows={14}
                                        value={inputValue}
                                        onChange={(e) => { setInputValue(e.target.value); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                if (inputValue.trim()) {
                                                    void doEvalRef.current?.(inputValue);
                                                }
                                                setInputValue('');
                                                setInputOpen(false);
                                            }
                                        }}
                                        onScroll={(e) => {
                                            if (inputPreRef.current) {
                                                inputPreRef.current.scrollTop = e.currentTarget.scrollTop;
                                                inputPreRef.current.scrollLeft = e.currentTarget.scrollLeft;
                                            }
                                        }}
                                        style={{
                                            ...popupTextareaStyle,
                                            position: 'relative',
                                            zIndex: 1,
                                            background: 'transparent',
                                            color: 'transparent',
                                            caretColor: '#e0e0e0',
                                            whiteSpace: 'pre-wrap',
                                            wordWrap: 'break-word',
                                        }}
                                        placeholder="Paste multi-line code here..."
                                        spellCheck={false}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => { setInputOpen(false); }}
                                        style={toolBtnStyle}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (inputValue.trim()) {
                                                void doEvalRef.current?.(inputValue);
                                            }
                                            setInputValue('');
                                            setInputOpen(false);
                                        }}
                                        style={{ ...toolBtnStyle, border: '1px solid #5af78e', color: '#5af78e' }}
                                    >
                                        Send (Ctrl+Enter)
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Clear Terminal button */}
                <button
                    onClick={() => { termRef.current?.clear(); }}
                    style={toolBtnStyle}
                >
                    Clear
                </button>

                {/* Copy Output button + popup */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => {
                            if (!outputOpen) {
                                setOutputText(outputBufferRef.current.join('\n'));
                            }
                            setOutputOpen((v) => !v);
                            setInputOpen(false);
                        }}
                        style={{ ...toolBtnStyle, color: outputOpen ? '#5af78e' : '#888888' }}
                    >
                        Copy Output
                    </button>
                    {outputOpen && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 19 }}
                                onMouseDown={() => { setOutputOpen(false); }}
                            />
                            <div
                                style={popupStyle}
                                onKeyDown={(e) => { if (e.key === 'Escape') setOutputOpen(false); }}
                            >
                                <span style={{ color: '#686868', fontSize: 10 }}>
                                    REPL output — select to copy or use Copy All
                                </span>
                                <textarea
                                    autoFocus
                                    readOnly
                                    rows={16}
                                    value={outputText}
                                    style={{ ...popupTextareaStyle, color: '#5af78e' }}
                                    spellCheck={false}
                                />
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => {
                                            outputBufferRef.current = [];
                                            setOutputText('');
                                        }}
                                        style={toolBtnStyle}
                                    >
                                        Clear
                                    </button>
                                    <CopyButton text={outputText} label="Copy All" />
                                    <button
                                        onClick={() => { setOutputOpen(false); }}
                                        style={toolBtnStyle}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <KeyManagement
                keyPair={repl.keyPair}
                onGenerate={repl.generateKeyPair}
                onImport={repl.importPrivateKey}
            />
        </div>
    );
}
