import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { listen } from '@tauri-apps/api/event';
import { api } from '../../lib/tauri';
import { useSettingsStore, FONT_OPTIONS } from '../../features/settings/settingsStore';
import { useConversationStore } from '../../features/conversations/conversationStore';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  cwd: string;
  /** Shell command to run inside the PTY (e.g. "claude --resume <id>") */
  command?: string;
  /** Raw KEY=VALUE text block; passed to PTY as injected env vars */
  envText?: string;
  /** Called when the PTY process exits */
  onExit?: () => void;
  /** Key used for activity tracking in the store (defaults to sessionId) */
  activityKey?: string;
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

/** Read a File/Blob and return [bytes as number[], file extension] */
async function readImageFile(file: File): Promise<[number[], string]> {
  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png';
  const buf = await file.arrayBuffer();
  return [Array.from(new Uint8Array(buf)), ext];
}

// Track active listener instance per sessionId globally to prevent duplicate event handling
// when async unlisten races with new listen during component remount
const activeInstances = new Map<string, number>();

export function TerminalView({ sessionId, cwd, command, envText, onExit, activityKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { theme, fontSize, fontId } = useSettingsStore();
  const fontFamily = FONT_OPTIONS.find((f) => f.id === fontId)?.family ?? "'Geist Mono', monospace";
  const [imagePath, setImagePath] = useState<string | null>(null);

  // Save an image file and show the path chip
  const handleImageFile = useCallback(async (file: File) => {
    try {
      const [data, ext] = await readImageFile(file);
      const path = await api.saveTempImage(data, ext);
      setImagePath(path);
    } catch (e) {
      console.error('Failed to save image:', e);
    }
  }, []);

  // Insert the saved path into PTY stdin
  const insertPath = useCallback(() => {
    if (imagePath) {
      api.ptyWrite(sessionId, imagePath);
      setImagePath(null);
    }
  }, [sessionId, imagePath]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
      fontFamily,
      fontSize,
      lineHeight: 1.5,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(fitAddon);
    term.loadAddon(unicode11Addon);
    unicode11Addon.activate(term);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    let disposed = false;

    // Increment instance counter — only the latest instance writes to the terminal.
    // This prevents duplicate output when async unlisten races with new listen.
    const prevInstance = activeInstances.get(sessionId) ?? 0;
    const instance = prevInstance + 1;
    activeInstances.set(sessionId, instance);

    // IME accumulation fix
    let isComposing = false;
    const textarea = containerRef.current.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
    const onCompositionStart = () => { isComposing = true; };
    const onCompositionEnd = () => {
      isComposing = false;
      setTimeout(() => {
        if (!disposed && !isComposing && textarea) textarea.value = '';
      }, 0);
    };
    if (textarea) {
      textarea.addEventListener('compositionstart', onCompositionStart);
      textarea.addEventListener('compositionend', onCompositionEnd);
    }

    // Paste: intercept image items before xterm handles the event
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.stopPropagation();
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleImageFile(file);
          return;
        }
      }
    };

    // Drag-and-drop image files onto the terminal
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files[0];
      if (file && file.type.startsWith('image/')) handleImageFile(file);
    };

    // Ctrl+Shift+C: copy selection via native clipboard (Linux WebView workaround)
    // Ctrl+V: try reading image from native clipboard first (Linux workaround)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const selection = term.getSelection();
        if (selection) {
          e.preventDefault();
          api.writeClipboardText(selection).catch(() => {});
        }
        return;
      }
      if (e.ctrlKey && !e.shiftKey && e.key === 'v') {
        api.readClipboardImage().then((path) => {
          if (!disposed) setImagePath(path);
        }).catch(() => { /* text paste — let xterm handle it */ });
      }
    };

    const el = containerRef.current;
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('paste', onPaste as EventListener, true); // capture phase
    el.addEventListener('dragover', onDragOver as EventListener);
    el.addEventListener('drop', onDrop as EventListener);

    // Pipe PTY output to xterm — guard with instance check to prevent duplicate writes
    const isActive = () => !disposed && activeInstances.get(sessionId) === instance;

    // Track output activity — mark session as "working" while data flows,
    // idle after 3s of silence. Only updates store on state transitions.
    const setSessionActive = useConversationStore.getState().setSessionActive;
    const trackKey = activityKey ?? sessionId;
    let idleTimer = 0;

    const unlistenOutput = listen<string>(`pty:output:${sessionId}`, (event) => {
      if (isActive()) {
        term.write(event.payload);
        setSessionActive(trackKey, true);
        clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          if (!disposed) setSessionActive(trackKey, false);
        }, 3000);
      }
    });

    const unlistenExit = listen(`pty:exit:${sessionId}`, () => {
      if (isActive()) {
        term.writeln('\r\n\x1b[2m[session ended]\x1b[0m');
        onExit?.();
      }
    });

    const dataDisposable = term.onData((data) => {
      if (isActive()) api.ptyWrite(sessionId, data);
    });

    let ptyReady = false;
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      if (ptyReady && !disposed) api.ptyResize(sessionId, rows, cols);
    });

    const ro = new ResizeObserver(() => {
      if (disposed) return;
      const el = containerRef.current;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        requestAnimationFrame(() => fitAddon.fit());
      }
    });
    ro.observe(containerRef.current);

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
      clearTimeout(idleTimer);
      setSessionActive(trackKey, false);
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (textarea) {
        textarea.removeEventListener('compositionstart', onCompositionStart);
        textarea.removeEventListener('compositionend', onCompositionEnd);
      }
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('paste', onPaste as EventListener, true);
      el.removeEventListener('dragover', onDragOver as EventListener);
      el.removeEventListener('drop', onDrop as EventListener);
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      term.dispose();
      api.ptyKill(sessionId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Dynamically update theme / font size
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    term.options.fontSize = fontSize;
    term.options.fontFamily = fontFamily;
    fitAddonRef.current?.fit();
  }, [theme, fontSize, fontFamily]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', padding: '4px', boxSizing: 'border-box', overflow: 'hidden' }}
      />

      {/* Image path chip */}
      {imagePath && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          maxWidth: '80%',
          zIndex: 10,
        }}>
          <span style={{ fontSize: 14 }}>🖼</span>
          <span style={{
            fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320,
          }}>
            {imagePath}
          </span>
          <button
            onClick={insertPath}
            style={{
              padding: '2px 10px', fontSize: 11, borderRadius: 4, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: 'pointer', flexShrink: 0,
            }}
          >
            插入路径
          </button>
          <button
            onClick={() => setImagePath(null)}
            style={{
              padding: '2px 6px', fontSize: 11, borderRadius: 4, border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
