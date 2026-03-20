import { ReactNode } from 'react';

interface Props { children: ReactNode; }

export function MainPanel({ children }: Props) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>
      {children}
    </div>
  );
}
