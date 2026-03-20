import { timeAgo } from '../../lib/utils';

interface Props { ms: number | null; }

export function TimeAgo({ ms }: Props) {
  if (!ms) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return <span style={{ color: 'var(--text-muted)' }}>{timeAgo(ms)}</span>;
}
