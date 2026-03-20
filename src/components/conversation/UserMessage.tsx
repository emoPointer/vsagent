import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';

interface Props { message: Message; }

export function UserMessage({ message }: Props) {
  const text = message.content_text ?? '';
  return (
    <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
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
