import { apiRequest } from '@/lib/api/client';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  read_at: string | null;
  created_at: string;
}

export function listNotifications() {
  return apiRequest<{ items: AppNotification[]; total: number; unread_count: number }>(
    '/platform/notifications?offset=0&limit=50',
  );
}

export function markNotificationRead(id: string) {
  return apiRequest<{ message: string }>(`/platform/notifications/${id}/read`, {
    method: 'PATCH',
  });
}
