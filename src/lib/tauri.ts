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

  listMessages: (conversationId: string) =>
    invoke<Message[]>('list_messages', { conversationId }),

  searchMessages: (query: string) =>
    invoke<SearchResult[]>('search_messages', { query }),
};
