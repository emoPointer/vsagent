import { invoke } from '@tauri-apps/api/core';
import type { Workspace, Conversation, Message, SearchResult } from '../types';

export const api = {
  listWorkspaces: () =>
    invoke<Workspace[]>('list_workspaces'),

  listConversations: (workspaceId?: string) =>
    invoke<Conversation[]>('list_conversations', { workspaceId }),

  pinConversation: (id: string, pinned: boolean) =>
    invoke<void>('pin_conversation', { id, pinned }),

  archiveConversation: (id: string, archived: boolean) =>
    invoke<void>('archive_conversation', { id, archived }),

  renameConversation: (id: string, title: string) =>
    invoke<void>('rename_conversation', { id, title }),

  deleteConversation: (id: string) =>
    invoke<void>('delete_conversation', { id }),

  listMessages: (conversationId: string) =>
    invoke<Message[]>('list_messages', { conversationId }),

  searchMessages: (query: string) =>
    invoke<SearchResult[]>('search_messages', { query }),

  openInTerminal: (path: string, command?: string) =>
    invoke<void>('open_in_terminal', { path, command: command ?? null }),

  ptyCreate: (sessionId: string, cwd: string, command?: string, rows?: number, cols?: number) =>
    invoke<void>('pty_create', { sessionId, cwd, command: command ?? null, rows: rows ?? null, cols: cols ?? null }),

  ptyWrite: (sessionId: string, data: string) =>
    invoke<void>('pty_write', { sessionId, data }),

  ptyResize: (sessionId: string, rows: number, cols: number) =>
    invoke<void>('pty_resize', { sessionId, rows, cols }),

  ptyKill: (sessionId: string) =>
    invoke<void>('pty_kill', { sessionId }),
};
