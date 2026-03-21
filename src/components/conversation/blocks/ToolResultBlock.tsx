import { useState } from 'react';
import { ToolResultBlock as ToolResultBlockType, extractResultText } from '../../../lib/contentBlocks';

interface Props { block: ToolResultBlockType; }

const MAX_LINES = 20;

export function ToolResultBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const text = extractResultText(block.content);
  const lines = text.split('\n');
  const isTruncated = lines.length > MAX_LINES;
  const displayText = expanded || !isTruncated ? text : lines.slice(0, MAX_LINES).join('\n') + '\n…';

  return (
    <div className="my-1 rounded" style={{ background: '#0d1117', border: '1px solid var(--border)' }}>
      <div className="px-3 py-1 flex items-center" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          output
        </span>
        {isTruncated && (
          <button
            className="text-xs ml-auto"
            style={{ color: 'var(--accent)' }}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? '收起' : `展开 (${lines.length} 行)`}
          </button>
        )}
      </div>
      <pre className="px-3 py-2 text-xs overflow-x-auto"
        style={{ color: '#e2e8f0', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {displayText || '(empty)'}
      </pre>
    </div>
  );
}
