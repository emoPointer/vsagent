import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useSettingsStore } from '../../../features/settings/settingsStore';

interface Props { text: string; }

export function TextBlock({ text }: Props) {
  const { theme } = useSettingsStore();
  if (!text.trim()) return null;
  // prose-invert is for dark backgrounds (white text); omit in light mode
  const proseClass = theme === 'dark' ? 'prose prose-invert prose-sm max-w-none' : 'prose prose-sm max-w-none';
  return (
    <div className={proseClass} style={{ color: 'var(--text-primary)', fontSize: '13px' }}>
      <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
