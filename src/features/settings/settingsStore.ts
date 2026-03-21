import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type FontSize = 12 | 13 | 14 | 15 | 16;

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack used in xterm */
  family: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { id: 'geist-mono',       label: 'Geist Mono',       family: "'Geist Mono', monospace" },
  { id: 'jetbrains-mono',   label: 'JetBrains Mono',   family: "'JetBrains Mono', monospace" },
  { id: 'fira-code',        label: 'Fira Code',        family: "'Fira Code', monospace" },
  { id: 'ibm-plex-mono',    label: 'IBM Plex Mono',    family: "'IBM Plex Mono', monospace" },
  { id: 'source-code-pro',  label: 'Source Code Pro',  family: "'Source Code Pro', monospace" },
  { id: 'commit-mono',      label: 'Commit Mono',      family: "'Commit Mono', monospace" },
];

interface Settings {
  theme: Theme;
  fontSize: FontSize;
  fontId: string;
}

interface SettingsStore extends Settings {
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
  setFontId: (id: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 13,
      fontId: 'geist-mono',
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setFontId: (fontId) => set({ fontId }),
    }),
    { name: 'vsagent-settings' }
  )
);
