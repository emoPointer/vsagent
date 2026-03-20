import { SearchResult } from '../../types';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  result: SearchResult;
}

export function SearchResultItem({ result }: Props) {
  const select = useConversationStore((s) => s.select);
  const selectedId = useConversationStore((s) => s.selectedId);
  const isSelected = selectedId === result.conversation_id;

  const plainSnippet = result.snippet.replace(/<[^>]*>/g, '');

  return (
    <button
      className="w-full text-left px-3 py-2 flex flex-col gap-1 transition-colors"
      style={{
        background: isSelected ? 'rgba(0,122,204,0.2)' : 'transparent',
        borderLeft: isSelected ? '2px solid #007acc' : '2px solid transparent',
      }}
      onClick={() => select(result.conversation_id)}
    >
      <div className="flex items-center gap-2 w-full">
        <span
          className="flex-1 truncate text-xs font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {result.conversation_title ?? result.conversation_id.slice(0, 8)}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {result.role}
        </span>
      </div>
      <p
        className="text-xs"
        style={{
          color: 'var(--text-muted)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {plainSnippet}
      </p>
    </button>
  );
}
