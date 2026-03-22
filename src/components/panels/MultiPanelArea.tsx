import { useRef, useState, useEffect, useCallback } from 'react';
import { ConversationView } from '../conversation/ConversationView';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  panelIds: string[];
}

export function MultiPanelArea({ panelIds }: Props) {
  const removePanel = useConversationStore((s) => s.removePanel);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollVal, setScrollVal] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);

  // Keep scroll in bounds when panels change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      setMaxScroll(max);
      // Clamp scrollVal if panels removed
      if (el.scrollLeft > max) {
        el.scrollLeft = max;
        setScrollVal(max);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [panelIds]);

  // Sync slider → container scroll
  const handleSlider = useCallback((val: number) => {
    setScrollVal(val);
    if (containerRef.current) containerRef.current.scrollLeft = val;
  }, []);

  // Sync container scroll → slider (e.g., touch/trackpad)
  const handleScroll = useCallback(() => {
    if (containerRef.current) setScrollVal(containerRef.current.scrollLeft);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Slider bar — only visible when there are more than 2 panels */}
      {panelIds.length > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
          height: 28,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
            {panelIds.length} 个面板
          </span>
          <input
            type="range"
            min={0}
            max={maxScroll}
            value={scrollVal}
            onChange={(e) => handleSlider(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent)', height: 4, cursor: 'pointer' }}
          />
        </div>
      )}

      {/* Horizontal panel track */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {panelIds.map((id) => (
          <div
            key={id}
            style={{
              flex: '0 0 50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Close button */}
            <button
              onClick={() => removePanel(id)}
              title="关闭面板"
              style={{
                position: 'absolute', top: 6, right: 6, zIndex: 10,
                width: 20, height: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text-muted)',
                fontSize: 11,
                cursor: 'pointer',
                opacity: 0.7,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              ✕
            </button>

            <ConversationView conversationId={id} />
          </div>
        ))}
      </div>
    </div>
  );
}
