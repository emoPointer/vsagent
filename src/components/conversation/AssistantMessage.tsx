import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';
import { parseBlocks } from '../../lib/contentBlocks';
import { BlockList } from './blocks/BlockList';

interface Props { message: Message; }

export function AssistantMessage({ message }: Props) {
  const blocks = parseBlocks(message.content_json);

  return (
    <div className="py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: '#4c1d95', color: 'white' }}>Claude</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(message.created_at)}
        </span>
        {message.token_count_output != null && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {message.token_count_output} tokens
          </span>
        )}
      </div>
      {blocks.length > 0
        ? <BlockList blocks={blocks} />
        : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>(empty)</p>
      }
    </div>
  );
}
