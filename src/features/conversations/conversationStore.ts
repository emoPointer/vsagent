import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  /** When set, main area shows an embedded terminal for a new session */
  newSessionCwd: string | null;
  /** Unique ID per new-session invocation so PTY restarts on each click */
  newSessionId: string | null;
  /** Ordered list of conversation IDs currently visible side-by-side */
  panels: string[];
  /** All panels that should remain mounted (superset of panels) — keeps PTY alive when switching */
  mountedPanels: string[];
  /** Per-conversation PTY revision counter — increment to force terminal restart */
  ptyRevisions: Record<string, number>;
  /** Sessions that are actively producing output (Claude is working) */
  activeSessions: Record<string, boolean>;
  select: (id: string) => void;
  addPanel: (id: string) => void;
  /** Explicitly close a panel — removes from both visible and mounted (kills PTY) */
  removePanel: (id: string) => void;
  startNewSession: (cwd: string) => void;
  /** Increment PTY revision for a conversation, forcing TerminalView to remount */
  restartPty: (conversationId: string) => void;
  /** Mark a session as actively producing output (Claude is working) */
  setSessionActive: (id: string, active: boolean) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  newSessionCwd: null,
  newSessionId: null,
  panels: [],
  mountedPanels: [],
  ptyRevisions: {},
  activeSessions: {},
  select: (id) => set((s) => ({
    selectedId: id,
    newSessionCwd: null,
    newSessionId: null,
    panels: [id],
    mountedPanels: s.mountedPanels.includes(id) ? s.mountedPanels : [...s.mountedPanels, id],
  })),
  addPanel: (id) => set((s) => {
    if (s.panels.includes(id)) return s;
    const base = s.panels.length > 0 ? s.panels : (s.selectedId ? [s.selectedId] : []);
    return {
      panels: [...base, id],
      selectedId: id,
      newSessionCwd: null,
      newSessionId: null,
      mountedPanels: s.mountedPanels.includes(id) ? s.mountedPanels : [...s.mountedPanels, id],
    };
  }),
  removePanel: (id) => set((s) => {
    const panels = s.panels.filter((p) => p !== id);
    const mountedPanels = s.mountedPanels.filter((p) => p !== id);
    return { panels, mountedPanels, selectedId: panels.length > 0 ? panels[panels.length - 1] : null };
  }),
  startNewSession: (cwd) => set((s) => ({
    newSessionCwd: cwd,
    newSessionId: `new-${Date.now()}`,
    selectedId: null,
    panels: [],
    mountedPanels: s.mountedPanels,  // keep background PTYs alive
  })),
  restartPty: (id) => set((s) => ({
    ptyRevisions: { ...s.ptyRevisions, [id]: (s.ptyRevisions[id] ?? 0) + 1 },
  })),
  setSessionActive: (id, active) => set((s) => {
    if (s.activeSessions[id] === active) return s;
    return { activeSessions: { ...s.activeSessions, [id]: active } };
  }),
  clear: () => set({ selectedId: null, newSessionCwd: null, newSessionId: null, panels: [], mountedPanels: [] }),
}));
