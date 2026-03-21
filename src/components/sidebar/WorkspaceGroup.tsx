import { useState } from 'react';
import { Conversation, Workspace } from '../../types';
import { ConversationItem } from './ConversationItem';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  workspace: Workspace;
  conversations: Conversation[];
  searchQuery: string;
}

export function WorkspaceGroup({ workspace, conversations, searchQuery }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { selectedId, select } = useConversationStore();

  const filtered = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.branch_name?.toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div>
      {/* Workspace header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ opacity: 0.7 }}>{expanded ? '▾' : '▸'}</span>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {workspace.name}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '1px 6px',
          color: 'var(--text-muted)',
        }}>
          {filtered.length}
        </span>
      </button>

      {/* Conversation list */}
      {expanded && filtered.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          selected={selectedId === conv.id}
          onClick={() => select(conv.id)}
        />
      ))}
    </div>
  );
}
