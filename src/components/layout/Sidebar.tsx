import { ReactNode } from 'react';

interface Props {
  width: number;
  children: ReactNode;
}

export function Sidebar({ width, children }: Props) {
  return (
    <div
      className="flex flex-col h-full overflow-hidden flex-shrink-0"
      style={{ width, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {children}
    </div>
  );
}
