export interface Workspace {
  id: string;
  name: string;
  root_path: string;
  git_repo_root: string | null;
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  workspace_id: string | null;
  provider: string;
  title: string | null;
  status: 'idle' | 'running' | 'waiting_input' | 'error' | 'archived';
  branch_name: string | null;
  pinned: boolean;
  archived: boolean;
  last_message_at: number | null;
  jsonl_path: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content_text: string | null;
  content_json: string | null;
  token_count_input: number | null;
  token_count_output: number | null;
  seq: number;
  created_at: number;
}

export interface SearchResult {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  role: string;
  snippet: string;
  rank: number;
}
