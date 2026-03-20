import ReactMarkdown from 'react-markdown';
import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';

interface Props { message: Message; }

export function AssistantMessage({ message }: Props) {
  const text = message.content_text ?? '';
  const isToolCall = text.startsWith('[tool:');

  return (
    <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: '#4c1d95', color: 'white' }}>Claude</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(message.created_at)}
        </span>
        {message.token_count_output && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {message.token_count_output} tokens
          </span>
        )}
      </div>
      {isToolCall ? (
        <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-panel)', color: '#22c55e' }}>
          {text}
        </code>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none text-sm"
          style={{ color: 'var(--text-primary)' }}>
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
