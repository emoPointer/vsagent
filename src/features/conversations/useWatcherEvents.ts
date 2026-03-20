import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

export function useWatcherEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    const unlistenUpdated = listen<{ conversation_id: string }>('conversation:updated', (e) => {
      qc.invalidateQueries({ queryKey: ['messages', e.payload.conversation_id] });
    });
    const unlistenChanged = listen('conversations:changed', () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    });

    return () => {
      unlistenUpdated.then((fn) => fn());
      unlistenChanged.then((fn) => fn());
    };
  }, [qc]);
}
