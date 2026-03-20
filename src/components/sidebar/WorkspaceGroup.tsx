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
      <button
        className="w-full px-3 py-1.5 text-left flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span className="truncate">{workspace.name}</span>
        <span className="ml-auto">{filtered.length}</span>
      </button>
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
