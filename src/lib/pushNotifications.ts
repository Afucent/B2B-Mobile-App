import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, unregisterPushToken } from '@/lib/api/notifications';

const ANDROID_CHANNEL_ID = 'afbex-alerts';

/** Show system-style banner at top while app is open (same as lock-screen alerts). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'AFBEX alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1A3A3A',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: false,
    enableVibrate: true,
    showBadge: true,
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureAndroidNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return Boolean(
    asked.granted || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  );
}

function expoProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }
  const allowed = await requestNotificationPermissions();
  if (!allowed) return null;

  const projectId = expoProjectId();
  try {
    const result = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return result.data || null;
  } catch {
    return null;
  }
}

let registeredToken: string | null = null;

export async function syncPushRegistration(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  await registerPushToken(token, Platform.OS).catch(() => undefined);
  registeredToken = token;
}

export async function clearPushRegistration(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await unregisterPushToken(token).catch(() => undefined);
}

/** Present a local heads-up notification (top of screen) while the app is active. */
export async function presentLocalAlert(title: string, body: string, data?: Record<string, unknown>) {
  await ensureAndroidNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: data ?? {},
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
