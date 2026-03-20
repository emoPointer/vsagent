import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  clear: () => set({ selectedId: null }),
}));
