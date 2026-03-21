import { ContentBlock } from '../../../lib/contentBlocks';
import { TextBlock } from './TextBlock';
import { ToolUseBlock } from './ToolUseBlock';
import { ToolResultBlock } from './ToolResultBlock';

interface Props { blocks: ContentBlock[]; }

export function BlockList({ blocks }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {blocks.map((block, i) => {
        if (block.type === 'text') return <TextBlock key={i} text={block.text} />;
        if (block.type === 'tool_use') return <ToolUseBlock key={block.id ?? i} block={block} />;
        if (block.type === 'tool_result') return <ToolResultBlock key={block.tool_use_id ?? i} block={block} />;
        return null;
      })}
    </div>
  );
}
