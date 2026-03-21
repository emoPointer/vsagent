import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { ConfirmDialog } from '../common/ConfirmDialog';
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
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { selectedId, select } = useConversationStore();

  useEffect(() => {
    if (renaming) {
      setDraftTitle(conversation.title ?? '');
      setTimeout(() => { inputRef.current?.select(); }, 0);
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

  const handleDelete = async () => {
    await api.deleteConversation(conversation.id);
    if (selectedId === conversation.id) select('');
    qc.invalidateQueries({ queryKey: ['conversations'] });
    setConfirming(false);
  };

  const label = conversation.title ?? conversation.id.slice(0, 10);

  return (
    <>
      {confirming && (
        <ConfirmDialog
          message={`删除对话「${label}」？此操作不可撤销。`}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}

      <div
        className="w-full text-left px-3 flex flex-col gap-0.5 cursor-pointer"
        style={{
          padding: '8px 12px',
          background: selected
            ? 'rgba(59,130,246,0.18)'
            : hovered
            ? 'var(--hover-bg)'
            : 'transparent',
          borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'background 0.12s',
        }}
        onClick={renaming ? undefined : onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Row 1: status + title + actions */}
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
                background: 'var(--bg-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                color: 'var(--text-primary)',
                fontSize: 12,
                padding: '2px 6px',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          ) : (
            <span
              className="flex-1 truncate"
              style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}
            >
              {label}
            </span>
          )}

          {/* Action buttons — appear on hover */}
          {hovered && !renaming && (
            <div
              className="flex items-center gap-1 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <IconBtn
                title="重命名"
                onClick={(e) => { e.stopPropagation(); setRenaming(true); }}
              >
                {/* pencil */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </IconBtn>
              <IconBtn
                title="删除"
                danger
                onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              >
                {/* trash */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </IconBtn>
            </div>
          )}
        </div>

        {/* Row 2: branch + time */}
        <div className="flex items-center gap-2" style={{ paddingLeft: 18 }}>
          {conversation.branch_name && (
            <span
              className="truncate"
              style={{ color: 'var(--text-muted)', fontSize: 11, maxWidth: 110 }}
            >
              #{conversation.branch_name}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
            <TimeAgo ms={conversation.last_message_at} />
          </span>
        </div>
      </div>
    </>
  );
}

function IconBtn({
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 5, border: 'none',
        background: h ? (danger ? 'rgba(239,68,68,0.25)' : 'var(--hover-bg-strong)') : 'transparent',
        color: h ? (danger ? '#ef4444' : 'var(--text-primary)') : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'all 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
