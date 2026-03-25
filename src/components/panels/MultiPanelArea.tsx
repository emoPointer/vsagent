import { useRef, useEffect, useCallback, useState } from 'react';
import { ConversationView } from '../conversation/ConversationView';
import { RemoteConversationView, NewRemoteSessionView } from '../conversation/RemoteConversationView';
import { useConversationStore } from '../../features/conversations/conversationStore';
import { useSshStore } from '../../features/ssh/sshStore';

interface Props {
  panelIds: string[];
}

/** Minimum panel width as a fraction of total */
const MIN_FRACTION = 0.15;

/** Create equal-sized fractions for N panels */
function equalSizes(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n);
}

export function MultiPanelArea({ panelIds }: Props) {
  const removePanel = useConversationStore((s) => s.removePanel);
  const containerRef = useRef<HTMLDivElement>(null);

  // Panel sizes as fractions that sum to 1.0
  const [sizes, setSizes] = useState<number[]>(() => equalSizes(panelIds.length));

  // Drag-over state (counter pattern to handle child dragenter/leave)
  const dragCounter = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Divider drag state
  const dividerDragging = useRef<number | null>(null); // index of divider being dragged
  const dividerStartX = useRef(0);
  const dividerStartSizes = useRef<number[]>([]);

  // Reset sizes when panel count changes
  useEffect(() => {
    setSizes(equalSizes(panelIds.length));
  }, [panelIds.length]);

  // Divider drag: global mousemove/mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const idx = dividerDragging.current;
      if (idx === null) return;
      const el = containerRef.current;
      if (!el) return;
      const totalWidth = el.clientWidth;
      const dx = e.clientX - dividerStartX.current;
      const deltaFraction = dx / totalWidth;
      const prev = dividerStartSizes.current;

      const newLeft = Math.max(MIN_FRACTION, Math.min(prev[idx] + deltaFraction, prev[idx] + prev[idx + 1] - MIN_FRACTION));
      const newRight = prev[idx] + prev[idx + 1] - newLeft;

      setSizes((s) => {
        const next = [...s];
        next[idx] = newLeft;
        next[idx + 1] = newRight;
        return next;
      });
    };
    const onUp = () => {
      if (dividerDragging.current !== null) {
        dividerDragging.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    dividerDragging.current = index;
    dividerStartX.current = e.clientX;
    dividerStartSizes.current = [...sizes];
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sizes]);

  // Drag enter/leave (counter to avoid child flicker)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('text/conversation-id')) return;
    dragCounter.current++;
    setIsDraggingOver(true);
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('text/conversation-id')) return;
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDraggingOver(false);
    }
    e.preventDefault();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('text/conversation-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const id = e.dataTransfer.getData('text/conversation-id');
    if (id) useConversationStore.getState().addPanel(id);
  }, []);

  // Single panel: full width, no drag animation needed
  const isSingle = panelIds.length === 1 && !isDraggingOver;

  return (
    <div
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {panelIds.map((id, i) => (
        <div key={id} style={{ display: 'contents' }}>
          {/* Panel */}
          <div
            style={{
              width: isSingle ? '100%' : `${(sizes[i] ?? (1 / panelIds.length)) * 100}%`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              transition: isDraggingOver ? 'width 0.28s ease' : undefined,
            }}
          >
            {/* Close button — only when 2+ panels */}
            {panelIds.length > 1 && (
              <button
                onClick={() => removePanel(id)}
                title="关闭面板"
                style={{
                  position: 'absolute', top: 7, right: 44, zIndex: 10,
                  width: 20, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  fontSize: 10,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                ✕
              </button>
            )}

            <PanelContent panelId={id} />
          </div>

          {/* Draggable divider between panels */}
          {i < panelIds.length - 1 && (
            <div
              onMouseDown={(e) => handleDividerMouseDown(e, i)}
              onDoubleClick={() => setSizes(equalSizes(panelIds.length))}
              title="拖动调整宽度，双击重置"
              style={{
                width: 5,
                flexShrink: 0,
                cursor: 'col-resize',
                background: 'var(--border)',
                position: 'relative',
                zIndex: 5,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border)'; }}
            />
          )}
        </div>
      ))}

      {/* Ghost placeholder shown while dragging */}
      {isDraggingOver && (
        <div
          style={{
            width: '50%',
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed var(--accent)',
            borderRadius: 4,
            margin: '0 8px',
            color: 'var(--accent)',
            fontSize: 12,
            fontFamily: 'monospace',
            opacity: 0.7,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease',
          }}
        >
          释放以添加面板
        </div>
      )}
    </div>
  );
}

/** Route panel to local ConversationView or remote RemoteConversationView based on id prefix */
function PanelContent({ panelId }: { panelId: string }) {
  const remoteConversations = useSshStore((s) => s.remoteConversations);

  if (panelId.startsWith('ssh-new:')) {
    return <NewRemoteSessionView sessionKey={panelId} />;
  }

  if (panelId.startsWith('ssh:')) {
    const convId = panelId.slice(4);
    const conv = remoteConversations.find((c) => c.id === convId);
    if (!conv) {
      return (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>远程对话未找到</p>
        </div>
      );
    }
    return <RemoteConversationView conversation={conv} />;
  }

  return <ConversationView conversationId={panelId} />;
}
