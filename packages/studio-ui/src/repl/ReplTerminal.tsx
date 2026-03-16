import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
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

// ---- write helpers (pure) ----

function writeln(term: Terminal, text: string) {
    term.write(text + '\r\n');
}

function writePrompt(term: Terminal) {
    term.write(PROMPT);
}

function redrawInputLine(term: Terminal, text: string, cursorPos: number) {
    // Use syntax-highlighted text for display; cursor math uses original text.length
    // because ANSI escape codes are zero-width and don't affect terminal column count.
    term.write('\r\x1b[K' + PROMPT + highlightJs(text));
    const stepsBack = text.length - cursorPos;
    if (stepsBack > 0) {
        term.write(`\x1b[${stepsBack}D`);
    }
}

function printResult(term: Terminal, result: ReplResult) {
    const ts = new Date().toLocaleTimeString();
    const pfx = `${GRAY}[${ts}]${RESET} `;
    if (result.consoleOutput && result.consoleOutput.length > 0) {
        for (const line of result.consoleOutput) {
            writeln(term, pfx + `${CYAN}→ ${line}${RESET}`);
        }
    }
    if (result.kind === 'error') {
        writeln(term, pfx + `${RED}${result.text}${RESET}`);
    } else {
        writeln(term, pfx + `${BRIGHT_GREEN}${result.text}${RESET}`);
    }
}

function printSuggestions(term: Terminal, suggestions: string[], selectedIdx: number) {
    writeln(term, '');
    for (let i = 0; i < suggestions.length; i++) {
        if (i === selectedIdx) {
            writeln(term, `  ${CYAN}▶ ${suggestions[i]}${RESET}`);
        } else {
            writeln(term, `  ${GRAY}  ${suggestions[i]}${RESET}`);
        }
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
                navigator.clipboard.writeText(text).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
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

function KeyRow({ label, value, dimmed }: { label: string; value: string; dimmed?: boolean }) {
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
                title={value}
            >
                {value}
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
                        <KeyRow label="priv:" value={keyPair.privateKeyB64} dimmed />
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

// ---- REPL Terminal ----

interface ReplTerminalProps {
    clientId: string | null;
    sessionId: string | null;
}

export function ReplTerminal({ clientId, sessionId }: ReplTerminalProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // All mutable state accessed inside the stable terminal effect lives in refs
    const replRef = useRef<UseReplReturn | null>(null);
    const inputBufferRef = useRef('');
    const cursorPosRef = useRef(0);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const suggestionsRef = useRef<string[]>([]);
    const suggestionIndexRef = useRef(-1);
    const isEvalPendingRef = useRef(false);

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
            convertEol: true,
            scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        fitAddon.fit();
        term.focus();

        writeln(term, `\x1b[97mWelcome to BT Studio REPL${RESET}`);
        writeln(term, `${GRAY}Type JavaScript and press Enter. Tab for completions.${RESET}`);
        writePrompt(term);

        async function doEval(code: string) {
            if (!code.trim()) {
                writePrompt(term);
                return;
            }

            const r = replRef.current;
            if (!r) {
                writeln(term, `${RED}REPL not ready${RESET}`);
                writePrompt(term);
                return;
            }

            // History (dedup)
            const hist = historyRef.current;
            if (!hist.includes(code)) {
                hist.push(code);
                if (hist.length > 100) hist.splice(0, hist.length - 100);
            }
            historyIndexRef.current = -1;

            isEvalPendingRef.current = true;
            term.write(`${GRAY}…${RESET}`);

            try {
                const result = await r.sendEval(code);
                term.write('\r\x1b[K');
                printResult(term, result);
            } catch (err) {
                term.write('\r\x1b[K');
                writeln(term, `${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`);
            } finally {
                isEvalPendingRef.current = false;
                writePrompt(term);
            }
        }

        async function doCompletions() {
            const r = replRef.current;
            if (!r) return;

            const prefix = inputBufferRef.current;
            try {
                const completions = await r.sendCompletions(prefix);
                if (completions.length === 0) return;

                suggestionsRef.current = completions;
                suggestionIndexRef.current = 0;

                if (completions.length === 1) {
                    // Single match — accept immediately
                    const match = prefix.match(/([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*\.?)$/);
                    if (match) {
                        const lastDot = match[1].lastIndexOf('.');
                        const replacement = lastDot >= 0
                            ? match[1].slice(0, lastDot + 1) + completions[0]
                            : completions[0];
                        inputBufferRef.current = prefix.slice(0, prefix.length - match[1].length) + replacement;
                    }
                    suggestionsRef.current = [];
                    suggestionIndexRef.current = -1;
                    cursorPosRef.current = inputBufferRef.current.length;
                    redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
                } else {
                    // Multiple — print list inline
                    writeln(term, '');
                    printSuggestions(term, completions, 0);
                    writePrompt(term);
                    term.write(prefix);
                }
            } catch {
                // ignore
            }
        }

        function acceptSuggestionAtIndex(idx: number) {
            const suggestions = suggestionsRef.current;
            const suggestion = suggestions[idx];
            if (!suggestion) return;

            const prefix = inputBufferRef.current;
            const match = prefix.match(/([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*\.?)$/);
            if (match) {
                const lastDot = match[1].lastIndexOf('.');
                const replacement = lastDot >= 0
                    ? match[1].slice(0, lastDot + 1) + suggestion
                    : suggestion;
                inputBufferRef.current = prefix.slice(0, prefix.length - match[1].length) + replacement;
            }
            cursorPosRef.current = inputBufferRef.current.length;
            redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
        }

        // ---- onData: printable character input ----
        // onData fires after dead key / IME composition resolves, giving properly
        // composed characters. Control sequences are filtered and handled by onKey.
        const dataDisposable = term.onData((data) => {
            if (isEvalPendingRef.current) return;

            // Skip sequences handled by onKey
            if (data === '\r') return;                          // Enter
            if (data === '\x7f') return;                        // Backspace
            if (data.startsWith('\x1b')) return;                // Escape sequences
            if (data.length === 1 && data.charCodeAt(0) < 0x20) return; // Ctrl sequences

            // Clear suggestions on printable input
            if (suggestionsRef.current.length > 0) {
                suggestionsRef.current = [];
                suggestionIndexRef.current = -1;
            }

            const pos = cursorPosRef.current;
            const buf = inputBufferRef.current;
            inputBufferRef.current = buf.slice(0, pos) + data + buf.slice(pos);
            cursorPosRef.current = pos + data.length;
            historyIndexRef.current = -1;

            // Always redraw so syntax highlighting stays consistent as tokens
            // change meaning (e.g. typing a quote starts a new string context)
            redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
        });

        // ---- onKey: control / special keys only ----
        const keyDisposable = term.onKey(({ domEvent: ev }) => {
            if (isEvalPendingRef.current) return;

            const suggestions = suggestionsRef.current;
            const hasSuggestions = suggestions.length > 0;

            // ---- suggestions navigation ----
            if (hasSuggestions) {
                if (ev.key === 'Escape') {
                    suggestionsRef.current = [];
                    suggestionIndexRef.current = -1;
                    return;
                }
                if (ev.key === 'Tab') {
                    ev.preventDefault();
                    const cur = suggestionIndexRef.current;
                    const next = ev.shiftKey
                        ? (cur <= 0 ? suggestions.length - 1 : cur - 1)
                        : (cur >= suggestions.length - 1 ? 0 : cur + 1);
                    suggestionIndexRef.current = next;
                    acceptSuggestionAtIndex(next);
                    return;
                }
                // Printable chars clear suggestions via onData; special keys fall through
            }

            // ---- Enter ----
            if (ev.key === 'Enter') {
                if (ev.shiftKey) {
                    inputBufferRef.current += '\n';
                    cursorPosRef.current = inputBufferRef.current.length;
                    term.write('\r\n');
                    return;
                }
                const code = inputBufferRef.current;
                inputBufferRef.current = '';
                cursorPosRef.current = 0;
                term.write('\r\n');
                void doEval(code);
                return;
            }

            // ---- Backspace ----
            if (ev.key === 'Backspace') {
                const pos = cursorPosRef.current;
                const buf = inputBufferRef.current;
                if (pos > 0) {
                    inputBufferRef.current = buf.slice(0, pos - 1) + buf.slice(pos);
                    cursorPosRef.current = pos - 1;
                    redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
                }
                return;
            }

            // ---- ArrowLeft — move cursor left ----
            if (ev.key === 'ArrowLeft') {
                if (cursorPosRef.current > 0) {
                    cursorPosRef.current -= 1;
                    term.write('\x1b[D');
                }
                return;
            }

            // ---- ArrowRight — move cursor right ----
            if (ev.key === 'ArrowRight') {
                if (cursorPosRef.current < inputBufferRef.current.length) {
                    cursorPosRef.current += 1;
                    term.write('\x1b[C');
                }
                return;
            }

            // ---- ArrowUp — history backward ----
            if (ev.key === 'ArrowUp') {
                const hist = historyRef.current;
                if (hist.length === 0) return;
                if (historyIndexRef.current === -1) {
                    historyIndexRef.current = hist.length - 1;
                } else if (historyIndexRef.current > 0) {
                    historyIndexRef.current -= 1;
                }
                inputBufferRef.current = hist[historyIndexRef.current];
                cursorPosRef.current = inputBufferRef.current.length;
                redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
                return;
            }

            // ---- ArrowDown — history forward ----
            if (ev.key === 'ArrowDown') {
                const hist = historyRef.current;
                if (historyIndexRef.current === -1) return;
                if (historyIndexRef.current < hist.length - 1) {
                    historyIndexRef.current += 1;
                    inputBufferRef.current = hist[historyIndexRef.current];
                } else {
                    historyIndexRef.current = -1;
                    inputBufferRef.current = '';
                }
                cursorPosRef.current = inputBufferRef.current.length;
                redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
                return;
            }

            // ---- Tab / Ctrl+Space — trigger completions ----
            if (ev.key === 'Tab' || (ev.ctrlKey && ev.key === ' ')) {
                ev.preventDefault();
                void doCompletions();
                return;
            }

            // ---- Ctrl+C — clear input ----
            if (ev.ctrlKey && ev.key === 'c') {
                inputBufferRef.current = '';
                cursorPosRef.current = 0;
                historyIndexRef.current = -1;
                term.write('^C\r\n');
                writePrompt(term);
                return;
            }

            // ---- Ctrl+L — clear screen ----
            if (ev.ctrlKey && ev.key === 'l') {
                term.clear();
                redrawInputLine(term, inputBufferRef.current, cursorPosRef.current);
                return;
            }
        });

        const ro = new ResizeObserver(() => fitAddon.fit());
        ro.observe(containerRef.current);

        return () => {
            dataDisposable.dispose();
            keyDisposable.dispose();
            ro.disconnect();
            term.dispose();
        };
    }, []); // intentionally empty — terminal is created once; handlers use replRef

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0a' }}>
            {/* Ensure xterm's IME helper textarea stays off-screen and invisible */}
            <style>{`.xterm-helper-textarea { opacity: 0 !important; left: -9999px !important; top: -9999px !important; }`}</style>
            <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }} />
            <KeyManagement
                keyPair={repl.keyPair}
                onGenerate={repl.generateKeyPair}
                onImport={repl.importPrivateKey}
            />
        </div>
    );
}
