import ReactMarkdown from 'react-markdown';

interface Props { text: string; }

export function TextBlock({ text }: Props) {
  if (!text.trim()) return null;
  return (
    <div className="prose prose-invert prose-sm max-w-none"
      style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
