import { apiRequest } from '@/lib/api/client';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category: string;
  event_type: string;
  actor_user_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  priority: string;
  metadata?: Record<string, unknown> | null;
  link_url?: string | null;
  read_at: string | null;
  created_at: string;
}

export function listNotifications() {
  return apiRequest<{ items: AppNotification[]; total: number; unread_count: number }>(
    '/platform/notifications?offset=0&limit=50',
  );
}

export function getUnreadNotificationCount() {
  return apiRequest<{ unread_count: number }>('/platform/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiRequest<{ message: string }>(`/platform/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ message: string }>('/platform/notifications/mark-all-read', {
    method: 'POST',
  });
}

export function deleteNotification(id: string) {
  return apiRequest<{ message: string }>(`/platform/notifications/${id}`, {
    method: 'DELETE',
  });
}

/** Resolve an Expo Router path from notification entity / metadata. */
export function resolveNotificationRoute(item: AppNotification): string | null {
  const metaPath = item.metadata?.mobile_path;
  if (typeof metaPath === 'string' && metaPath.startsWith('/')) {
    return metaPath;
  }

  switch (item.entity_type) {
    case 'field_visit':
      return item.entity_id ? `/visit-detail?visitId=${item.entity_id}` : '/(app)/visits';
    case 'leave_request':
      return '/leave-management';
    case 'attendance_record':
      return '/(app)/calendar';
    case 'user':
      return '/(app)/profile';
    default:
      break;
  }

  const event = (item.event_type || '').toLowerCase();
  if (event.startsWith('visit.')) return '/(app)/visits';
  if (event.startsWith('leave.')) return '/leave-management';
  if (event.startsWith('attendance.') || event.startsWith('tracking.')) {
    return '/(app)/calendar';
  }
  if (event.startsWith('employee.') || event.startsWith('security.')) {
    return '/(app)/profile';
  }

  const title = item.title.toLowerCase();
  if (title.includes('leave')) return '/leave-management';
  if (title.includes('visit')) return '/(app)/visits';
  if (title.includes('clock') || title.includes('attendance')) return '/(app)/calendar';
  return null;
}
