import { Message } from '../../types';
import { parseBlocks } from '../../lib/contentBlocks';
import { BlockList } from './blocks/BlockList';

interface Props { message: Message; }

export function AssistantMessage({ message }: Props) {
  const blocks = parseBlocks(message.content_json);

  return (
    <div className="py-3">
      {blocks.length > 0
        ? <BlockList blocks={blocks} />
        : null
      }
      {message.token_count_output != null && (
        <div className="mt-2" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
          · claude · {message.token_count_output} tokens
        </div>
      )}
    </div>
  );
}
