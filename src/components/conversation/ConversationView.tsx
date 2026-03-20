import { useMessages } from '../../features/conversations/useMessages';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';
import { MessageList } from './MessageList';

interface Props { conversationId: string; }

export function ConversationView({ conversationId }: Props) {
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const { data: conv } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.listConversations(),
    select: (convs) => convs.find((c) => c.id === conversationId),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {conv?.title ?? conversationId.slice(0, 8)}
          </h1>
          {conv?.branch_name && (
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {conv.branch_name}
            </p>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-panel)', color: 'var(--text-muted)' }}>
          {conv?.provider ?? 'claude_code'}
        </span>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading messages...</p>
        </div>
      ) : (
        <MessageList messages={messages} />
      )}
    </div>
  );
}
