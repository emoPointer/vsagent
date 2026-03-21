import { createPortal } from 'react-dom';
import { useSettingsStore, Theme, FontSize } from '../../features/settings/settingsStore';

interface Props {
  onClose: () => void;
}

const FONT_SIZES: FontSize[] = [12, 13, 14, 15, 16];

export function SettingsPanel({ onClose }: Props) {
  const { theme, fontSize, setTheme, setFontSize } = useSettingsStore();

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '24px 28px',
          minWidth: 340,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>设置</span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
              padding: '2px 6px', borderRadius: 4,
            }}
          >✕</button>
        </div>

        {/* Theme */}
        <Section label="主题">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['dark', 'light'] as Theme[]).map((t) => (
              <ThemeButton
                key={t}
                label={t === 'dark' ? '深色' : '浅色'}
                active={theme === t}
                onClick={() => setTheme(t)}
                preview={t}
              />
            ))}
          </div>
        </Section>

        {/* Font size */}
        <Section label={`字体大小 (${fontSize}px)`}>
          <div style={{ display: 'flex', gap: 6 }}>
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setFontSize(s)}
                style={{
                  width: 40, height: 32,
                  borderRadius: 6,
                  border: `1px solid ${fontSize === s ? 'var(--accent)' : 'var(--border)'}`,
                  background: fontSize === s ? 'rgba(59,130,246,0.15)' : 'transparent',
                  color: fontSize === s ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: fontSize === s ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >{s}</button>
            ))}
          </div>
        </Section>
      </div>
    </div>,
    document.body
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ThemeButton({ label, active, onClick, preview }: {
  label: string; active: boolean; onClick: () => void; preview: Theme;
}) {
  const isDark = preview === 'dark';
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 0 8px',
        border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8, cursor: 'pointer',
        background: 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}
    >
      {/* Mini preview */}
      <div style={{
        width: 60, height: 36, borderRadius: 4,
        background: isDark ? '#111' : '#f0f0f0',
        border: `1px solid ${isDark ? '#2a2a2a' : '#d1d5db'}`,
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ height: 8, background: isDark ? '#1a1a1a' : '#e4e4e4', borderBottom: `1px solid ${isDark ? '#2a2a2a' : '#d1d5db'}` }} />
        <div style={{ display: 'flex', height: 28 }}>
          <div style={{ width: 16, background: isDark ? '#111' : '#ebebeb', borderRight: `1px solid ${isDark ? '#2a2a2a' : '#d1d5db'}` }} />
          <div style={{ flex: 1, padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[70, 50, 85].map((w, i) => (
              <div key={i} style={{ height: 3, width: `${w}%`, borderRadius: 2, background: isDark ? '#3a3a3a' : '#c5c5c5' }} />
            ))}
          </div>
        </div>
      </div>
      <span style={{ fontSize: 11, color: active ? 'var(--accent)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
    </button>
  );
}
