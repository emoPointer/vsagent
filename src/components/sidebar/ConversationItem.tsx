import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { api } from '../../lib/tauri';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, selected, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { selectedId, select } = useConversationStore();

  useEffect(() => {
    if (renaming) {
      setDraftTitle(conversation.title ?? '');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, conversation.title]);

  const commitRename = async () => {
    const t = draftTitle.trim();
    if (t && t !== conversation.title) {
      await api.renameConversation(conversation.id, t);
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
    setRenaming(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${conversation.title ?? conversation.id.slice(0, 8)}"?`)) return;
    await api.deleteConversation(conversation.id);
    if (selectedId === conversation.id) select('');
    qc.invalidateQueries({ queryKey: ['conversations'] });
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenaming(true);
  };

  return (
    <div
      className="w-full text-left px-3 py-2 flex flex-col gap-0.5 cursor-pointer relative"
      style={{
        background: selected
          ? 'rgba(59,130,246,0.18)'
          : hovered
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
      onClick={renaming ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 w-full">
        <StatusDot status={conversation.status} />

        {renaming ? (
          <input
            ref={inputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              background: 'var(--bg-panel)',
              border: '1px solid var(--accent)',
              borderRadius: 3,
              color: 'var(--text-primary)',
              fontSize: 12,
              padding: '1px 4px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        ) : (
          <span
            className="flex-1 truncate text-xs font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {conversation.title ?? conversation.id.slice(0, 8)}
          </span>
        )}

        {/* Action buttons — only visible on hover, hidden when renaming */}
        {hovered && !renaming && (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <ActionBtn title="Rename" onClick={handleRename}>✎</ActionBtn>
            <ActionBtn title="Delete" onClick={handleDelete} danger>✕</ActionBtn>
          </div>
        )}

        {!hovered && conversation.pinned && <span className="text-xs flex-shrink-0">📌</span>}
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

function ActionBtn({
  children, title, onClick, danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: h ? (danger ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)') : 'transparent',
        border: 'none',
        color: h ? (danger ? '#ef4444' : 'var(--text-primary)') : 'var(--text-muted)',
        fontSize: 11,
        cursor: 'pointer',
        padding: '1px 4px',
        borderRadius: 3,
        lineHeight: 1.4,
        transition: 'color 0.1s, background 0.1s',
      }}
    >
      {children}
    </button>
  );
}
