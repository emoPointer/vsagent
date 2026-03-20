import { formatDistanceToNow } from 'date-fns';

export function timeAgo(ms: number): string {
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
