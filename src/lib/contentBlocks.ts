export type TextBlock = { type: 'text'; text: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export function parseBlocks(contentJson: string | null): ContentBlock[] {
  if (!contentJson) return [];
  try {
    const parsed = JSON.parse(contentJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((b): b is ContentBlock =>
      b && typeof b === 'object' && typeof b.type === 'string'
    );
  } catch {
    return [];
  }
}

// true if message is all tool output (not real human input)
export function isToolResultMessage(blocks: ContentBlock[]): boolean {
  return blocks.length > 0 && blocks.every((b) => b.type === 'tool_result');
}

// Extract text from tool_result content field (may be string or block array)
export function extractResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'object' && c !== null && 'text' in c ? (c as { text: string }).text : ''))
      .join('\n');
  }
  return '';
}
