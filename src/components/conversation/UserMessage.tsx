import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';
import { parseBlocks, isToolResultMessage } from '../../lib/contentBlocks';
import { BlockList } from './blocks/BlockList';

interface Props { message: Message; }

export function UserMessage({ message }: Props) {
  const blocks = parseBlocks(message.content_json);
  const isToolOutput = isToolResultMessage(blocks);

  // Tool output messages: no "You" label, render output blocks directly
  if (isToolOutput) {
    return (
      <div className="py-1.5">
        <BlockList blocks={blocks} />
      </div>
    );
  }

  // Real human input message
  const text = message.content_text ?? '';
  return (
    <div className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: 'var(--accent)', color: 'white' }}>You</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(message.created_at)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
        {text}
      </p>
    </div>
  );
}
