import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

export function useConversations(workspaceId?: string) {
  return useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => api.listConversations(workspaceId),
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.listWorkspaces(),
  });
}
