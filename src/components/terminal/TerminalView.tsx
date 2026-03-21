import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../lib/tauri';
import { useSettingsStore } from '../../features/settings/settingsStore';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  cwd: string;
  /** Shell command to run inside the PTY (e.g. "claude --resume <id>") */
  command?: string;
  /** Raw KEY=VALUE text block; passed to PTY as injected env vars */
  envText?: string;
}

const DARK_THEME = {
  background: '#0d0d0d', foreground: '#d4d4d4', cursor: '#d4d4d4',
  selectionBackground: 'rgba(59,130,246,0.3)',
  black: '#1a1a1a', brightBlack: '#6b7280',
  red: '#f87171', brightRed: '#fca5a5',
  green: '#4ade80', brightGreen: '#86efac',
  yellow: '#fbbf24', brightYellow: '#fde68a',
  blue: '#60a5fa', brightBlue: '#93c5fd',
  magenta: '#a78bfa', brightMagenta: '#c4b5fd',
  cyan: '#22d3ee', brightCyan: '#67e8f9',
  white: '#d4d4d4', brightWhite: '#f9fafb',
};

const LIGHT_THEME = {
  background: '#ffffff', foreground: '#1a1a1a', cursor: '#1a1a1a',
  selectionBackground: 'rgba(37,99,235,0.2)',
  black: '#1a1a1a', brightBlack: '#6b7280',
  red: '#dc2626', brightRed: '#ef4444',
  green: '#16a34a', brightGreen: '#22c55e',
  yellow: '#ca8a04', brightYellow: '#eab308',
  blue: '#2563eb', brightBlue: '#3b82f6',
  magenta: '#7c3aed', brightMagenta: '#8b5cf6',
  cyan: '#0891b2', brightCyan: '#06b6d4',
  white: '#374151', brightWhite: '#1a1a1a',
};

export function TerminalView({ sessionId, cwd, command, envText }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme, fontSize } = useSettingsStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize,
      lineHeight: 1.5,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(fitAddon);
    term.loadAddon(unicode11Addon);
    unicode11Addon.activate(term);  // use Unicode 11 table for CJK double-width chars
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Guard: prevent writing to this terminal instance after cleanup
    let disposed = false;

    // Fix xterm.js IME accumulation bug:
    // After each IME composition (e.g. Chinese input), xterm.js leaves the
    // hidden textarea's value intact. On the next composition, it diffs
    // textarea.value against "" (its starting point for the new composition),
    // so the residual text from the previous composition is included in onData,
    // causing accumulated duplicates (2 copies → 3 copies → ...) with each cycle.
    // Fix: clear the textarea after xterm.js has finished processing compositionend
    // and the subsequent input event (setTimeout lets both handlers run first).
    let isComposing = false;
    const textarea = containerRef.current.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
    const onCompositionStart = () => { isComposing = true; };
    const onCompositionEnd = () => {
      isComposing = false;
      setTimeout(() => {
        if (!disposed && !isComposing && textarea) {
          textarea.value = '';
        }
      }, 0);
    };
    if (textarea) {
      textarea.addEventListener('compositionstart', onCompositionStart);
      textarea.addEventListener('compositionend', onCompositionEnd);
    }

    // Pipe PTY output to xterm
    const unlistenOutput = listen<string>(`pty:output:${sessionId}`, (event) => {
      if (!disposed) term.write(event.payload);
    });

    // Pipe PTY exit to xterm
    const unlistenExit = listen(`pty:exit:${sessionId}`, () => {
      if (!disposed) term.writeln('\r\n\x1b[2m[session ended]\x1b[0m');
    });

    // Pipe keyboard input to PTY
    const dataDisposable = term.onData((data) => {
      if (!disposed) api.ptyWrite(sessionId, data);
    });

    // Resize PTY on terminal resize (only after PTY is created)
    let ptyReady = false;
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      if (ptyReady && !disposed) api.ptyResize(sessionId, rows, cols);
    });

    // Use ResizeObserver so the terminal fills the container on mount and on resize.
    // Guard against calling fit() when the container is hidden (display:none → size 0).
    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const el = containerRef.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        requestAnimationFrame(() => fitAddon.fit());
      }
    });
    ro.observe(containerRef.current);

    // Fit first to get actual dims, then launch PTY at the correct size
    // Track RAF ids so we can cancel them in cleanup (prevents double PTY creation)
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (disposed) return;
        fitAddon.fit();
        api.ptyCreate(sessionId, cwd, command, envText, term.rows, term.cols)
          .then(() => { if (!disposed) ptyReady = true; })
          .catch((err) => {
            if (!disposed) term.writeln(`\r\n\x1b[31mFailed to start terminal: ${err}\x1b[0m\r\n`);
          });
      });
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (textarea) {
        textarea.removeEventListener('compositionstart', onCompositionStart);
        textarea.removeEventListener('compositionend', onCompositionEnd);
      }
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      term.dispose();
      api.ptyKill(sessionId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Dynamically update terminal theme and font size without recreating
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    term.options.fontSize = fontSize;
    fitAddonRef.current?.fit();
  }, [theme, fontSize]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '4px', boxSizing: 'border-box', overflow: 'hidden' }}
    />
  );
}
