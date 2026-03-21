import { useEffect } from 'react';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') onConfirm();
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '24px 28px',
          minWidth: 280,
          maxWidth: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p style={{ color: 'var(--text-primary)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 16px', borderRadius: 5, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: 12,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 16px', borderRadius: 5, border: 'none',
              background: '#ef4444', color: '#fff', fontSize: 12,
              cursor: 'pointer', fontWeight: 600,
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}
