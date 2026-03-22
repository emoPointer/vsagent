import { useRef, useEffect, useCallback, useState } from 'react';
import { ConversationView } from '../conversation/ConversationView';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  panelIds: string[];
}

export function MultiPanelArea({ panelIds }: Props) {
  const removePanel = useConversationStore((s) => s.removePanel);
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // Scrollbar visibility
  const [showScrollbar, setShowScrollbar] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(100);

  // Drag-over state (counter pattern to handle child dragenter/leave)
  const dragCounter = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Thumb dragging state
  const thumbDragging = useRef(false);
  const thumbDragStartX = useRef(0);
  const thumbDragStartScrollLeft = useRef(0);

  // Sync scrollbar thumb position/size
  const syncScrollbar = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 1;
    setHasOverflow(overflow);
    if (!overflow) return;
    const ratio = el.clientWidth / el.scrollWidth;
    const tw = Math.max(ratio * el.clientWidth, 30);
    const tl = (el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (el.clientWidth - tw);
    setThumbWidth(tw);
    setThumbLeft(isNaN(tl) ? 0 : tl);
  }, []);

  // Scroll to end when a new panel is added
  useEffect(() => {
    const el = containerRef.current;
    if (!el || panelIds.length <= 1) return;
    el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
  }, [panelIds.length]);

  // Sync scrollbar on scroll + resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncScrollbar, { passive: true });
    const ro = new ResizeObserver(syncScrollbar);
    ro.observe(el);
    syncScrollbar();
    return () => {
      el.removeEventListener('scroll', syncScrollbar);
      ro.disconnect();
    };
  }, [syncScrollbar]);

  // Non-passive wheel: convert vertical scroll to horizontal only when
  // mouse is in the top title-bar zone (36px). Events bubble from title bar
  // children through containerRef up to outerRef.
  const TITLE_BAR_H = 36;
  useEffect(() => {
    const outer = outerRef.current;
    const inner = containerRef.current;
    if (!outer || !inner) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return;
      const rect = outer.getBoundingClientRect();
      if (e.clientY - rect.top > TITLE_BAR_H) return;
      e.preventDefault();
      inner.scrollLeft += e.deltaY;
    };
    outer.addEventListener('wheel', onWheel, { passive: false });
    return () => outer.removeEventListener('wheel', onWheel);
  }, []);

  // Thumb drag: global mousemove/mouseup
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!thumbDragging.current) return;
      const el = containerRef.current;
      if (!el) return;
      const dx = e.clientX - thumbDragStartX.current;
      const scrollRange = el.scrollWidth - el.clientWidth;
      const thumbRange = el.clientWidth - thumbWidth;
      el.scrollLeft = thumbDragStartScrollLeft.current + (dx / thumbRange) * scrollRange;
    };
    const onUp = () => { thumbDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [thumbWidth]);

  const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    thumbDragging.current = true;
    thumbDragStartX.current = e.clientX;
    thumbDragStartScrollLeft.current = containerRef.current?.scrollLeft ?? 0;
  }, []);

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
    // 2+ panels: auto-scroll right to show placeholder
    if (panelIds.length >= 2) {
      const el = containerRef.current;
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
    }
  }, [panelIds.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    const id = e.dataTransfer.getData('text/conversation-id');
    if (id) useConversationStore.getState().addPanel(id);
  }, []);

  // Panel flex-basis: 50% when 2+, or when 1 + dragging; else 100%
  const panelBasis = panelIds.length >= 2 || (panelIds.length === 1 && isDraggingOver)
    ? '50%'
    : '100%';

  return (
    <div
      ref={outerRef}
      style={{ position: 'relative', height: '100%' }}
      onMouseEnter={() => setShowScrollbar(true)}
      onMouseLeave={() => setShowScrollbar(false)}
    >
      {/* Scrollable track */}
      <div
        ref={containerRef}
        className="panels-track"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollbarWidth: 'none',
        }}
      >
        {panelIds.map((id) => (
          <div
            key={id}
            style={{
              flex: `0 0 ${panelBasis}`,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border)',
              overflow: 'hidden',
              position: 'relative',
              transition: 'flex-basis 0.28s ease, width 0.28s ease',
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

            <ConversationView conversationId={id} />
          </div>
        ))}

        {/* Ghost placeholder shown while dragging */}
        {isDraggingOver && (
          <div
            style={{
              flex: '0 0 50%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--accent)',
              borderRadius: 4,
              margin: '8px',
              color: 'var(--accent)',
              fontSize: 12,
              fontFamily: 'monospace',
              opacity: 0.7,
              flexShrink: 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none',
            }}
          >
            释放以添加面板
          </div>
        )}
      </div>

      {/* Thin scrollbar at top — purely visual, clicks pass through */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 4,
          right: 4,
          height: 3,
          zIndex: 20,
          pointerEvents: 'none',
          opacity: showScrollbar && hasOverflow ? 1 : 0,
          transition: 'opacity 0.18s ease',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--bg-panel)',
            borderRadius: '0 0 2px 2px',
          }}
        />
        <div
          onMouseDown={handleThumbMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            left: thumbLeft,
            width: thumbWidth,
            height: 3,
            background: 'var(--text-muted)',
            borderRadius: '0 0 2px 2px',
            cursor: 'grab',
            opacity: 0.6,
            transition: thumbDragging.current ? 'none' : 'left 0.05s',
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.background = 'var(--text-muted)'; }}
        />
      </div>
    </div>
  );
}
