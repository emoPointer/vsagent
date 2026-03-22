import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  /** When set, main area shows an embedded terminal for a new session */
  newSessionCwd: string | null;
  /** Unique ID per new-session invocation so PTY restarts on each click */
  newSessionId: string | null;
  /** Ordered list of conversation IDs shown as side-by-side panels */
  panels: string[];
  select: (id: string) => void;
  addPanel: (id: string) => void;
  removePanel: (id: string) => void;
  startNewSession: (cwd: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  newSessionCwd: null,
  newSessionId: null,
  panels: [],
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
  clear: () => set({ selectedId: null, newSessionCwd: null, newSessionId: null, panels: [] }),
}));
