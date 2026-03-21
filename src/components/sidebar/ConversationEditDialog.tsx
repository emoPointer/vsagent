import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/tauri';
import { Conversation } from '../../types';

interface Props {
  conversation: Conversation;
  onClose: () => void;
}

export function ConversationEditDialog({ conversation, onClose }: Props) {
  const [title, setTitle] = useState(conversation.title ?? '');
  const [envText, setEnvText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    api.getConversationEnv(conversation.id).then((env) => {
      setEnvText(env);
      setLoading(false);
      setTimeout(() => titleRef.current?.select(), 0);
    });
  }, [conversation.id]);

  const handleSave = async () => {
    setSaving(true);
    const t = title.trim();
    if (t && t !== conversation.title) {
      await api.renameConversation(conversation.id, t);
    }
    await api.setConversationEnv(conversation.id, envText);
    qc.invalidateQueries({ queryKey: ['conversations'] });
    setSaving(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 20,
          width: 420,
          maxWidth: '90vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
          对话设置
        </h2>

        {/* 重命名 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>名称</label>
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            placeholder={conversation.id.slice(0, 16)}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 13,
              padding: '6px 10px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>

        {/* 环境变量 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            环境变量
            <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontWeight: 400 }}>
              KEY=VALUE，每行一个
            </span>
          </label>
          <textarea
            value={loading ? '加载中...' : envText}
            disabled={loading}
            onChange={(e) => setEnvText(e.target.value)}
            rows={6}
            placeholder={'OPENAI_API_KEY=sk-xxx\nANTHROPIC_API_KEY=sk-ant-xxx'}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 12,
              padding: '8px 10px',
              fontFamily: 'monospace',
              resize: 'vertical',
              outline: 'none',
              opacity: loading ? 0.5 : 1,
            }}
          />
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
            这些变量会在启动终端时自动注入，不同对话可以设置不同的值。
          </p>
        </div>

        {/* 按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              padding: '6px 14px', fontSize: 12, borderRadius: 4, border: 'none',
              background: 'var(--accent)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
