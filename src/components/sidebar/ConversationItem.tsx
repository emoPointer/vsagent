import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ConversationEditDialog } from './ConversationEditDialog';
import { api } from '../../lib/tauri';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  conversation: Conversation;
  workspaceName?: string;
  selected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, workspaceName, selected, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();
  const { selectedId, select } = useConversationStore();
  const isMounted = useConversationStore((s) => s.mountedPanels.includes(conversation.id));

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
      {editing && (
        <ConversationEditDialog
          conversation={conversation}
          onClose={() => setEditing(false)}
        />
      )}

      <div
        className="w-full text-left px-3 flex flex-col gap-0.5 cursor-pointer"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/conversation-id', conversation.id);
          e.dataTransfer.effectAllowed = 'copy';
          document.body.style.userSelect = 'none';
        }}
        onDragEnd={() => {
          document.body.style.userSelect = '';
        }}
        style={{
          padding: '8px 12px',
          userSelect: 'none',
          background: selected
            ? 'rgba(59,130,246,0.18)'
            : hovered
            ? 'var(--hover-bg)'
            : 'transparent',
          borderLeft: selected ? '2px solid var(--accent)' : '2px solid transparent',
          transition: 'background 0.12s',
        }}
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Row 1: status + title + actions */}
        <div className="flex items-center gap-2 w-full">
          <StatusDot status={isMounted ? 'running' : conversation.status} />

          <span
            className="flex-1 truncate"
            style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}
          >
            {label}
          </span>

          {/* Action buttons — appear on hover */}
          {hovered && (
            <div
              className="flex items-center gap-1 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <IconBtn
                title="设置"
                onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              >
                {/* settings / sliders */}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                  <line x1="4" y1="18" x2="20" y2="18"/>
                  <circle cx="9" cy="6" r="2" fill="var(--bg-primary)"/>
                  <circle cx="15" cy="12" r="2" fill="var(--bg-primary)"/>
                  <circle cx="9" cy="18" r="2" fill="var(--bg-primary)"/>
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

        {/* Row 2: project name + branch + time */}
        <div className="flex items-center gap-1" style={{ paddingLeft: 18 }}>
          {workspaceName && (
            <span
              className="truncate"
              style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.75, flexShrink: 1, minWidth: 0 }}
            >
              {workspaceName}
            </span>
          )}
          {workspaceName && conversation.branch_name && (
            <span style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.5, flexShrink: 0 }}>/</span>
          )}
          {conversation.branch_name && (
            <span
              className="truncate"
              style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.75, flexShrink: 1, minWidth: 0 }}
            >
              {conversation.branch_name}
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>
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
