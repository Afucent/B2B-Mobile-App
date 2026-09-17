import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  getUnreadNotificationCount,
  listNotifications,
  resolveNotificationRoute,
  type AppNotification,
} from '@/lib/api/notifications';
import { promptInstallPermissionsOnLogin } from '@/lib/locationPermissions';
import {
  clearPushRegistration,
  presentLocalAlert,
  requestNotificationPermissions,
  syncPushRegistration,
} from '@/lib/pushNotifications';

const POLL_MS = 20_000;

function openFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const linkUrl = typeof data.linkUrl === 'string' ? data.linkUrl : null;
  if (linkUrl?.startsWith('/')) {
    router.push(linkUrl as never);
    return;
  }
  const entityType = typeof data.entityType === 'string' ? data.entityType : null;
  const entityId = typeof data.entityId === 'string' ? data.entityId : null;
  const synthetic: AppNotification = {
    id: typeof data.notificationId === 'string' ? data.notificationId : 'push',
    title: '',
    message: '',
    category: 'system',
    event_type: '',
    entity_type: entityType,
    entity_id: entityId,
    priority: 'normal',
    read_at: null,
    created_at: new Date().toISOString(),
  };
  const route = resolveNotificationRoute(synthetic);
  if (route) router.push(route as never);
  else router.push('/notifications');
}

/**
 * Registers for OS push (lock screen) and shows top banners while the app is open.
 * Also polls unread items as a fallback when push delivery is delayed.
 */
export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const responseSub = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (status !== 'signedIn') {
      primed.current = false;
      seenIds.current.clear();
      void clearPushRegistration();
      return;
    }

    void (async () => {
      await requestNotificationPermissions();
      await promptInstallPermissionsOnLogin();
      await syncPushRegistration();
    })();

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      const id = typeof data?.notificationId === 'string' ? data.notificationId : null;
      if (id) seenIds.current.add(id);
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      openFromNotificationData(data);
    });

    return () => {
      receivedSub.remove();
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'signedIn') return;

    let cancelled = false;

    async function poll() {
      if (cancelled || AppState.currentState !== 'active') return;
      try {
        const data = await listNotifications();
        const unread = data.items.filter((item) => !item.read_at);
        if (!primed.current) {
          unread.forEach((item) => seenIds.current.add(item.id));
          primed.current = true;
          return;
        }
        for (const item of unread) {
          if (seenIds.current.has(item.id)) continue;
          seenIds.current.add(item.id);
          // Heads-up at top while app is open (same channel as remote push).
          await presentLocalAlert(item.title, item.message, {
            notificationId: item.id,
            entityType: item.entity_type ?? undefined,
            entityId: item.entity_id ?? undefined,
            linkUrl: item.link_url ?? undefined,
          });
        }
        // Keep badge roughly in sync on iOS.
        if (Platform.OS === 'ios') {
          const count = await getUnreadNotificationCount().catch(() => null);
          if (count) {
            await Notifications.setBadgeCountAsync(count.unread_count).catch(() => undefined);
          }
        }
      } catch {
        // ignore network blips
      }
    }

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void poll();
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      appSub.remove();
    };
  }, [status]);

  return <>{children}</>;
}
