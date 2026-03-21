import { useState } from 'react';
import { ToolUseBlock as ToolUseBlockType } from '../../../lib/contentBlocks';

interface Props { block: ToolUseBlockType; }

function getArgPreview(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  const first = Object.values(obj)[0];
  if (typeof first === 'string') return first.slice(0, 60).replace(/\n/g, ' ');
  return '';
}

export function ToolUseBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const inputStr = JSON.stringify(block.input, null, 2);
  const preview = getArgPreview(block.input);

  return (
    <div className="my-0.5">
      <button
        className="w-full text-left flex items-baseline gap-2 py-0.5"
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: 'pointer' }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', flexShrink: 0 }}>●</span>
        <span style={{ color: 'var(--tool-name)', fontSize: '12px', flexShrink: 0 }}>
          {block.name}
        </span>
        {!expanded && preview && (
          <span className="truncate" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {preview}
          </span>
        )}
      </button>
      {expanded && (
        <pre style={{
          margin: '2px 0 4px 18px',
          padding: '6px 10px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          fontSize: '11px',
          color: '#86efac',
          fontFamily: 'inherit',
          overflow: 'auto',
          maxHeight: '200px',
        }}>
          {inputStr}
        </pre>
      )}
    </div>
  );
}
