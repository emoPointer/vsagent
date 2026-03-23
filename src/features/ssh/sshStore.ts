import { create } from 'zustand';
import type { SshHost } from '../../types';
import { api } from '../../lib/tauri';
import { useSettingsStore } from '../settings/settingsStore';
import { useConversationStore } from '../conversations/conversationStore';

/** Parsed remote conversation from JSONL */
export interface RemoteConversation {
  id: string;
  title: string | null;
  workspacePath: string | null;
  branchName: string | null;
  lastMessageAt: number | null;
  messageCount: number;
  jsonlPath: string;
  /** Whether a claude process is currently running for this session */
  isActive: boolean;
}

/** Parsed remote workspace derived from JSONL paths */
export interface RemoteWorkspace {
  path: string;
  name: string;
}

interface SshStore {
  /** Currently connected SSH host, null if disconnected */
  connectedHost: SshHost | null;
  /** Remote conversations discovered on the connected host */
  remoteConversations: RemoteConversation[];
  /** Remote workspaces derived from conversation paths */
  remoteWorkspaces: RemoteWorkspace[];
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  /** Connect to an SSH host and discover conversations */
  connect: (host: SshHost) => Promise<void>;
  /** Disconnect from the current host */
  disconnect: () => void;
  /** Refresh remote conversations */
  refresh: () => Promise<void>;
}

/**
 * Parse JSONL content into a RemoteConversation.
 * Replicates the logic from Rust importer/parser.rs on the frontend side.
 */
function parseJsonlToConversation(jsonlPath: string, content: string, activeIds?: Set<string>): RemoteConversation | null {
  const lines = content.split('\n').filter(Boolean);
  if (lines.length === 0) return null;

  let sessionId: string | null = null;
  let cwd: string | null = null;
  let branch: string | null = null;
  let title: string | null = null;
  let lastTs: number | null = null;
  let messageCount = 0;
  let firstUserText: string | null = null;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);

      if (parsed.sessionId && !sessionId) sessionId = parsed.sessionId;
      if (parsed.cwd && !cwd) cwd = parsed.cwd;
      if (parsed.gitBranch && !branch) branch = parsed.gitBranch;

      // custom-title entries override title
      if (parsed.type === 'custom-title' && parsed.customTitle) {
        title = parsed.customTitle;
      }

      // Track first user text for fallback title
      if (parsed.type === 'user' && parsed.message?.role === 'user' && !firstUserText) {
        const content = parsed.message.content;
        if (typeof content === 'string') {
          firstUserText = content.slice(0, 100);
        } else if (Array.isArray(content)) {
          const textBlock = content.find((b: { type: string }) => b.type === 'text');
          if (textBlock?.text) firstUserText = textBlock.text.slice(0, 100);
        }
      }

      // Count actual messages
      if (['user', 'assistant', 'system'].includes(parsed.type) && parsed.message?.role) {
        if (parsed.isSidechain !== true) messageCount++;
      }

      // Track latest timestamp
      if (parsed.timestamp) {
        const ts = new Date(parsed.timestamp).getTime();
        if (!isNaN(ts) && (lastTs === null || ts > lastTs)) lastTs = ts;
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (!sessionId) return null;

  return {
    id: sessionId,
    title: title ?? firstUserText,
    workspacePath: cwd,
    branchName: branch,
    lastMessageAt: lastTs,
    messageCount,
    jsonlPath,
    isActive: activeIds?.has(sessionId) ?? false,
  };
}

/** Extract workspace info from a JSONL path like ~/.claude/projects/-home-user-project/... */
function deriveWorkspace(jsonlPath: string): RemoteWorkspace | null {
  // Path format: ~/.claude/projects/<encoded-path>/<session>.jsonl
  const match = jsonlPath.match(/\.claude\/projects\/([^/]+)\//);
  if (!match) return null;

  const encoded = match[1];
  // Decode: leading dash + dashes → slashes (e.g., -home-user-proj → /home/user/proj)
  const decoded = '/' + encoded.replace(/^-/, '').replace(/-/g, '/');
  const name = decoded.split('/').pop() ?? decoded;

  return { path: decoded, name };
}

export const useSshStore = create<SshStore>((set, get) => ({
  connectedHost: null,
  remoteConversations: [],
  remoteWorkspaces: [],
  loading: false,
  error: null,

  connect: async (host) => {
    set({ loading: true, error: null, connectedHost: host });
    try {
      await get().refresh();
      useSettingsStore.getState().setLastSshHost(host.name);
    } catch (e) {
      set({ connectedHost: null, loading: false, error: String(e) });
      throw e;
    }
  },

  disconnect: () => {
    // Remove all SSH panels
    const convStore = useConversationStore.getState();
    const sshPanels = convStore.panels.filter((p) => p.startsWith('ssh:') || p.startsWith('ssh-new:'));
    for (const id of sshPanels) {
      convStore.removePanel(id);
    }

    set({
      connectedHost: null,
      remoteConversations: [],
      remoteWorkspaces: [],
      loading: false,
      error: null,
    });
  },

  refresh: async () => {
    const host = get().connectedHost;
    if (!host) return;

    set({ loading: true, error: null });
    try {
      const result = await api.sshDiscoverConversations(host.name, host.user, host.port);
      const activeIds = new Set(result.active_session_ids);

      const conversations: RemoteConversation[] = [];
      const workspaceMap = new Map<string, RemoteWorkspace>();

      for (const file of result.files) {
        const conv = parseJsonlToConversation(file.path, file.content, activeIds);
        if (conv) {
          conversations.push(conv);
          const ws = deriveWorkspace(file.path);
          if (ws && !workspaceMap.has(ws.path)) {
            workspaceMap.set(ws.path, ws);
          }
        }
      }

      // Sort by recency
      conversations.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

      set({
        remoteConversations: conversations,
        remoteWorkspaces: Array.from(workspaceMap.values()),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },
}));

// Auto-refresh: poll every 30s while connected
let refreshInterval: ReturnType<typeof setInterval> | null = null;

useSshStore.subscribe((state, prev) => {
  const wasConnected = prev.connectedHost !== null;
  const isConnected = state.connectedHost !== null;

  if (isConnected && !wasConnected) {
    // Just connected — start polling
    refreshInterval = setInterval(() => {
      const s = useSshStore.getState();
      if (s.connectedHost && !s.loading) {
        s.refresh();
      }
    }, 30_000);
  } else if (!isConnected && wasConnected) {
    // Disconnected — stop polling
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }
});
