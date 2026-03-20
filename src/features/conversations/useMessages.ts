import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.listMessages(conversationId),
    enabled: !!conversationId,
  });
}
