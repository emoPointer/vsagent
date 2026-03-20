interface Props { status: string; }

const colors: Record<string, string> = {
  idle: '#555',
  running: '#22c55e',
  waiting_input: '#f59e0b',
  error: '#ef4444',
  archived: '#374151',
};

export function StatusDot({ status }: Props) {
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[status] ?? '#555' }} />
  );
}
