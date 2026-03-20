import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { truncate } from '../../lib/utils';

interface Props {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, selected, onClick }: Props) {
  return (
    <button
      className="w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-opacity-10 transition-colors"
      style={{
        background: selected ? 'rgba(0,122,204,0.2)' : 'transparent',
        borderLeft: selected ? '2px solid #007acc' : '2px solid transparent',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        <StatusDot status={conversation.status} />
        <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {conversation.title ?? conversation.id.slice(0, 8)}
        </span>
        {conversation.pinned && <span className="text-xs">📌</span>}
      </div>
      <div className="flex items-center gap-2 pl-4">
        {conversation.branch_name && (
          <span className="text-xs truncate max-w-24" style={{ color: 'var(--text-muted)' }}>
            {conversation.branch_name}
          </span>
        )}
        <span className="text-xs ml-auto">
          <TimeAgo ms={conversation.last_message_at} />
        </span>
      </div>
    </button>
  );
}

// suppress unused import warning — truncate is imported per spec
void truncate;
