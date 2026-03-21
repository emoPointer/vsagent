import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../lib/tauri';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  cwd: string;
  /** Shell command to run inside the PTY (e.g. "claude --resume <id>") */
  command?: string;
}

export function TerminalView({ sessionId, cwd, command }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0d0d0d',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: 'rgba(59,130,246,0.3)',
        black: '#1a1a1a',
        brightBlack: '#6b7280',
        red: '#f87171',
        brightRed: '#fca5a5',
        green: '#4ade80',
        brightGreen: '#86efac',
        yellow: '#fbbf24',
        brightYellow: '#fde68a',
        blue: '#60a5fa',
        brightBlue: '#93c5fd',
        magenta: '#a78bfa',
        brightMagenta: '#c4b5fd',
        cyan: '#22d3ee',
        brightCyan: '#67e8f9',
        white: '#d4d4d4',
        brightWhite: '#f9fafb',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    // Double RAF: first lets xterm insert its DOM; second waits for flex layout pass
    requestAnimationFrame(() => requestAnimationFrame(() => fitAddon.fit()));

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Launch PTY session in backend
    api.ptyCreate(sessionId, cwd, command).catch((err) => {
      term.writeln(`\r\n\x1b[31mFailed to start terminal: ${err}\x1b[0m\r\n`);
    });

    // Pipe PTY output to xterm
    const unlistenOutput = listen<string>(`pty:output:${sessionId}`, (event) => {
      term.write(event.payload);
    });

    // Pipe PTY exit to xterm
    const unlistenExit = listen(`pty:exit:${sessionId}`, () => {
      term.writeln('\r\n\x1b[2m[session ended]\x1b[0m');
    });

    // Pipe keyboard input to PTY
    const dataDisposable = term.onData((data) => {
      api.ptyWrite(sessionId, data);
    });

    // Resize PTY on terminal resize
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      api.ptyResize(sessionId, rows, cols);
    });

    // Use ResizeObserver so the terminal fills the container on mount and on resize
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      term.dispose();
      api.ptyKill(sessionId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: '4px', boxSizing: 'border-box', overflow: 'hidden' }}
    />
  );
}
