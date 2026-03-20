import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

export function useWatcherEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    listen<{ conversation_id: string }>('conversation:updated', (e) => {
      qc.invalidateQueries({ queryKey: ['messages', e.payload.conversation_id] });
    }).then((fn) => {
      if (cancelled) { fn(); } else { unlisteners.push(fn); }
    });

    listen('conversations:changed', () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    }).then((fn) => {
      if (cancelled) { fn(); } else { unlisteners.push(fn); }
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [qc]);
}
