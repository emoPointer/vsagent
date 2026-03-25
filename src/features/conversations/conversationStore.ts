import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  /** When set, main area shows an embedded terminal for a new session */
  newSessionCwd: string | null;
  /** Unique ID per new-session invocation so PTY restarts on each click */
  newSessionId: string | null;
  /** Ordered list of conversation IDs shown as side-by-side panels */
  panels: string[];
  /** Per-conversation PTY revision counter — increment to force terminal restart */
  ptyRevisions: Record<string, number>;
  select: (id: string) => void;
  addPanel: (id: string) => void;
  removePanel: (id: string) => void;
  startNewSession: (cwd: string) => void;
  /** Increment PTY revision for a conversation, forcing TerminalView to remount */
  restartPty: (conversationId: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  newSessionCwd: null,
  newSessionId: null,
  panels: [],
  ptyRevisions: {},
  select: (id) => set({ selectedId: id, newSessionCwd: null, newSessionId: null, panels: [id] }),
  addPanel: (id) => set((s) => {
    if (s.panels.includes(id)) return s;
    const base = s.panels.length > 0 ? s.panels : (s.selectedId ? [s.selectedId] : []);
    return { panels: [...base, id], selectedId: id, newSessionCwd: null, newSessionId: null };
  }),
  removePanel: (id) => set((s) => {
    const panels = s.panels.filter((p) => p !== id);
    return { panels, selectedId: panels.length > 0 ? panels[panels.length - 1] : null };
  }),
  startNewSession: (cwd) => set({ newSessionCwd: cwd, newSessionId: `new-${Date.now()}`, selectedId: null, panels: [] }),
  restartPty: (id) => set((s) => ({
    ptyRevisions: { ...s.ptyRevisions, [id]: (s.ptyRevisions[id] ?? 0) + 1 },
  })),
  clear: () => set({ selectedId: null, newSessionCwd: null, newSessionId: null, panels: [] }),
}));
