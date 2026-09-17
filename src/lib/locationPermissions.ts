import * as Location from 'expo-location';
import { PermissionsAndroid, Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

const LOGIN_PROMPTED_KEY = 'afbex.install_notify_location_v1';

export type AlwaysLocationResult = 'ok' | 'services_off' | 'denied' | 'background';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function androidSdk(): number {
  if (Platform.OS !== 'android') return 0;
  const sdk = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  return Number.isFinite(sdk) ? sdk : 0;
}

export async function diagnoseLocation(opts?: { always?: boolean }): Promise<AlwaysLocationResult | 'undetermined'> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return 'services_off';

  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    if (foreground.status === Location.PermissionStatus.UNDETERMINED) return 'undetermined';
    if (foreground.canAskAgain) return 'undetermined';
    return 'denied';
  }

  if (!opts?.always) return 'ok';

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.status === Location.PermissionStatus.GRANTED) return 'ok';
  if (background.canAskAgain !== false) return 'undetermined';
  return 'background';
}

async function requestAndroidFine(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (fine === PermissionsAndroid.RESULTS.GRANTED) return true;
    const coarse = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    return coarse === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Android 11+ shows a separate system popup with "Allow all the time" only when
 * ACCESS_BACKGROUND_LOCATION is requested AFTER while-using is already granted.
 */
async function requestAndroidAllowAllTheTime(): Promise<boolean> {
  if (Platform.OS !== 'android' || androidSdk() < 29) return false;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function isBackgroundGranted(): Promise<boolean> {
  const current = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return current?.status === Location.PermissionStatus.GRANTED;
}

/** While-using, then Allow all the time — must stay in the foreground between the two prompts. */
export async function requestAlwaysLocationAccess(): Promise<AlwaysLocationResult> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return 'services_off';

  if (Platform.OS === 'android') {
    await requestAndroidFine();
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    return 'denied';
  }

  if (await isBackgroundGranted()) return 'ok';

  if (Platform.OS === 'android') {
    // First sheet must fully close before Android will show Allow all the time.
    await delay(800);
    const nativeAlways = await requestAndroidAllowAllTheTime();
    if (nativeAlways || (await isBackgroundGranted())) return 'ok';
    await Location.requestBackgroundPermissionsAsync().catch(() => null);
    if (await isBackgroundGranted()) return 'ok';
    return 'background';
  }

  await Location.requestBackgroundPermissionsAsync().catch(() => null);
  return (await isBackgroundGranted()) ? 'ok' : 'background';
}

export async function requestForegroundLocationAccess(): Promise<AlwaysLocationResult> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return 'services_off';
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status === Location.PermissionStatus.GRANTED) return 'ok';
  return 'denied';
}

export async function requestAndroidNotificationPermission() {
  if (Platform.OS !== 'android' || androidSdk() < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Older / OEM builds may not expose POST_NOTIFICATIONS.
  }
}

/** First login after install: notifications, then location while-using, then Allow all the time. */
export async function promptInstallPermissionsOnLogin() {
  if (Platform.OS === 'web') return;
  try {
    const already = await SecureStore.getItemAsync(LOGIN_PROMPTED_KEY);
    if (already === '1') return;
    await SecureStore.setItemAsync(LOGIN_PROMPTED_KEY, '1');
    await delay(400);
    await requestAlwaysLocationAccess();
  } catch {
    // Login must not fail if an OS sheet is dismissed.
  }
}

/** @deprecated use promptInstallPermissionsOnLogin */
export async function promptLocationPermissionsOnLogin() {
  await promptInstallPermissionsOnLogin();
}

export function locationRequiredReason(result: AlwaysLocationResult): 'off' | 'denied' | 'background' {
  if (result === 'services_off') return 'off';
  if (result === 'denied') return 'denied';
  return 'background';
}
