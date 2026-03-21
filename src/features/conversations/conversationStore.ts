import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  /** When set, main area shows an embedded terminal for a new session */
  newSessionCwd: string | null;
  /** Unique ID per new-session invocation so PTY restarts on each click */
  newSessionId: string | null;
  select: (id: string) => void;
  startNewSession: (cwd: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  newSessionCwd: null,
  newSessionId: null,
  select: (id) => set({ selectedId: id, newSessionCwd: null, newSessionId: null }),
  startNewSession: (cwd) => set({ newSessionCwd: cwd, newSessionId: `new-${Date.now()}`, selectedId: null }),
  clear: () => set({ selectedId: null, newSessionCwd: null, newSessionId: null }),
}));
