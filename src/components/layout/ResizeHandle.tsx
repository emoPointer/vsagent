import { useCallback, useRef } from 'react';

interface Props {
  onResize: (delta: number) => void;
}

export function ResizeHandle({ onResize }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    e.preventDefault();

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onResize(e.clientX - startX.current);
      startX.current = e.clientX;
    };
    const onUp = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', onMove);
    }, { once: true });
  }, [onResize]);

  return (
    <div
      className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
      style={{ background: 'var(--border)' }}
      onMouseDown={onMouseDown}
    />
  );
}
