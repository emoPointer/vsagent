import type { Message } from '../../types';

interface RawLine {
  uuid?: string;
  parentUuid?: string;
  type: string;
  sessionId?: string;
  isSidechain?: boolean;
  timestamp?: string;
  message?: {
    role?: string;
    content?: unknown;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (block.type === 'text') return block.text ?? '';
        if (block.type === 'tool_use') return `[tool: ${block.name ?? 'unknown'}]`;
        if (block.type === 'tool_result') {
          return typeof block.content === 'string' ? block.content : '[tool_result]';
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function normalizeContentJson(content: unknown): string | null {
  if (Array.isArray(content)) {
    const json = JSON.stringify(content);
    return json === '[]' ? null : json;
  }
  if (typeof content === 'string') {
    return JSON.stringify([{ type: 'text', text: content }]);
  }
  return null;
}

/**
 * Parse raw JSONL content (full file) into Message[] for MessageList display.
 */
export function parseRemoteMessages(jsonlContent: string, conversationId: string): Message[] {
  const messages: Message[] = [];
  let seq = 0;

  for (const line of jsonlContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let raw: RawLine;
    try {
      raw = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (raw.isSidechain) continue;
    if (!['user', 'assistant', 'system'].includes(raw.type)) continue;

    const role = raw.message?.role;
    if (!role || !['user', 'assistant', 'system'].includes(role)) continue;

    const content = raw.message?.content;
    const text = content != null ? extractText(content) : null;
    const contentJson = content != null ? normalizeContentJson(content) : null;

    const tsMs = raw.timestamp
      ? new Date(raw.timestamp).getTime()
      : 0;

    messages.push({
      id: raw.uuid ?? `auto-${seq}`,
      conversation_id: conversationId,
      parent_id: raw.parentUuid ?? null,
      role: role as 'user' | 'assistant' | 'system',
      content_text: text && text.length > 0 ? text : null,
      content_json: contentJson,
      token_count_input: raw.message?.usage?.input_tokens ?? null,
      token_count_output: raw.message?.usage?.output_tokens ?? null,
      seq,
      created_at: tsMs,
    });

    seq++;
  }

  return messages;
}
