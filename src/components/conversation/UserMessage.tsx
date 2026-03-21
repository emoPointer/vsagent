import { Message } from '../../types';
import { parseBlocks, isToolResultMessage } from '../../lib/contentBlocks';
import { BlockList } from './blocks/BlockList';

interface Props { message: Message; }

export function UserMessage({ message }: Props) {
  const blocks = parseBlocks(message.content_json);
  const isToolOutput = isToolResultMessage(blocks);

  // Tool result messages: render output inline, no user label
  if (isToolOutput) {
    return (
      <div className="py-1">
        <BlockList blocks={blocks} />
      </div>
    );
  }

  // Real human input: OpenCode style — blue left border
  const text = message.content_text ?? '';
  return (
    <div className="py-4" style={{ borderLeft: '2px solid var(--user-border)', paddingLeft: '16px', marginLeft: '0' }}>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)', margin: 0 }}>
        {text}
      </p>
    </div>
  );
}
