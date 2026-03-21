import { useState } from 'react';
import { ToolResultBlock as ToolResultBlockType, extractResultText } from '../../../lib/contentBlocks';

interface Props { block: ToolResultBlockType; }

const MAX_LINES = 15;

export function ToolResultBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(false);
  const text = extractResultText(block.content);
  const lines = text.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === ''));
  const isTruncated = lines.length > MAX_LINES;
  const displayLines = expanded || !isTruncated ? lines : lines.slice(0, MAX_LINES);

  if (lines.length === 0 || (lines.length === 1 && !lines[0])) return null;

  return (
    <div className="my-0.5 ml-4" style={{ borderLeft: '1px solid var(--border)', paddingLeft: '12px' }}>
      {displayLines.map((line, i) => (
        <div key={i} style={{ fontSize: '12px', color: 'var(--tool-output)', fontFamily: 'inherit', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {line || ' '}
        </div>
      ))}
      {isTruncated && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '2px', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
        >
          {expanded ? '▴ collapse' : `▾ ${lines.length - MAX_LINES} more lines`}
        </button>
      )}
    </div>
  );
}
