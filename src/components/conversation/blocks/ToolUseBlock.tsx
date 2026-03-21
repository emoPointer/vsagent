import { useState } from 'react';
import { ToolUseBlock as ToolUseBlockType } from '../../../lib/contentBlocks';

interface Props { block: ToolUseBlockType; }

export function ToolUseBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const inputStr = JSON.stringify(block.input, null, 2);

  return (
    <div className="rounded my-1.5" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)' }}>
      <button
        className="w-full text-left px-3 py-1.5 flex items-center gap-2"
        onClick={() => setExpanded((e) => !e)}
      >
        <span style={{ color: '#f59e0b', fontSize: '11px' }}>▶</span>
        <span className="font-mono text-xs font-semibold" style={{ color: '#f59e0b' }}>
          {block.name}
        </span>
        {!expanded && (
          <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
            {inputStr.slice(0, 80).replace(/\n/g, ' ')}
          </span>
        )}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {expanded ? '▴' : '▾'}
        </span>
      </button>
      {expanded && (
        <pre className="px-3 pb-2 text-xs overflow-x-auto"
          style={{ color: '#86efac', fontFamily: 'monospace', margin: 0 }}>
          {inputStr}
        </pre>
      )}
    </div>
  );
}
