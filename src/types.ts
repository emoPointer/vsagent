export interface Workspace {
  id: string;
  name: string;
  rootPath: string;
  gitRepoRoot: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  workspaceId: string | null;
  provider: string;
  title: string | null;
  status: string;
  branchName: string | null;
  pinned: boolean;
  archived: boolean;
  lastMessageAt: number | null;
  jsonlPath: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  parentId: string | null;
  role: string;
  contentText: string | null;
  contentJson: string | null;
  tokenCountInput: number | null;
  tokenCountOutput: number | null;
  seq: number;
  createdAt: number;
}

export interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationTitle: string | null;
  role: string;
  snippet: string;
  rank: number;
}
