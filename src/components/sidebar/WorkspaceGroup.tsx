import { useState } from 'react';
import { Conversation, Workspace } from '../../types';
import { ConversationItem } from './ConversationItem';
import { useConversationStore } from '../../features/conversations/conversationStore';
import { api } from '../../lib/tauri';

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
      <div className="flex items-center">
        <button
          className="flex-1 px-3 py-1.5 text-left flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-muted)' }}
          onClick={() => setExpanded((e) => !e)}
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span className="truncate">{workspace.name}</span>
          <span className="ml-auto mr-2">{filtered.length}</span>
        </button>
        <button
          title={`New session in ${workspace.root_path}`}
          onClick={() => api.openInTerminal(workspace.root_path)}
          className="px-2 py-1.5 text-xs"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          +
        </button>
      </div>
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
