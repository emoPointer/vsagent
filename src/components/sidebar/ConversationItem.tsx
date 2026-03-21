import { useState } from 'react';
import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { api } from '../../lib/tauri';

interface Props {
  conversation: Conversation;
  workspacePath: string;
  selected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, workspacePath, selected, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  const handleContinue = (e: React.MouseEvent) => {
    e.stopPropagation();
    // claude --resume <session_id> continues the conversation
    api.openInTerminal(workspacePath, `claude --resume "${conversation.id}"`);
  };

  return (
    <div
      className="w-full text-left px-3 py-2 flex flex-col gap-0.5 cursor-pointer"
      style={{
        background: selected ? 'rgba(0,122,204,0.2)' : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderLeft: selected ? '2px solid #007acc' : '2px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 w-full">
        <StatusDot status={conversation.status} />
        <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {conversation.title ?? conversation.id.slice(0, 8)}
        </span>
        {hovered ? (
          <button
            onClick={handleContinue}
            title="Open terminal and resume this session"
            className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--accent)', lineHeight: 1 }}
          >
            ▶
          </button>
        ) : (
          conversation.pinned && <span className="text-xs">📌</span>
        )}
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
    </div>
  );
}
