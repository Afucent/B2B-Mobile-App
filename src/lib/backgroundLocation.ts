import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as TaskManager from 'expo-task-manager';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';

import { ensureApiBaseReady, hydrateApiBaseCache, isPlaceholderApiBase } from '@/lib/api/client';
import { pingLocation } from '@/lib/api/attendance';
import { getPersistedApiBase, getToken, SECURE_STORE_OPTIONS } from '@/lib/storage';

export const BACKGROUND_LOCATION_TASK = 'afbex-background-location';

const PING_INTERVAL_KEY = 'afbex.ping_interval_minutes';
const LAST_PING_KEY = 'afbex.last_location_ping_at';
const TRACKING_ACTIVE_KEY = 'afbex.tracking_active';
const BATTERY_PROMPTED_KEY = 'afbex.battery_unrestricted_prompted';
const DEFAULT_PING_MINUTES = 20;
/** Keep GPS / the Android foreground service awake; server pings stay on the org interval. */
const NATIVE_GPS_INTERVAL_MS = 15_000;

export type BackgroundLocationStartFailure =
  | 'unavailable'
  | 'backgrounded'
  | 'services_off'
  | 'foreground_denied'
  | 'background_denied'
  | 'start_failed';

export type BackgroundLocationStartResult =
  | { ok: true }
  | { ok: false; reason: BackgroundLocationStartFailure };

let pingInFlight = false;

void getPersistedApiBase().then((url) => {
  if (url) hydrateApiBaseCache(url);
});

async function readStore(key: string) {
  if (Platform.OS === 'web') return null;
  return SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
}

async function writeStore(key: string, value: string) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
}

export async function persistPingIntervalMinutes(minutes: number) {
  const value = String(Math.min(Math.max(Math.round(minutes), 1), 60));
  await writeStore(PING_INTERVAL_KEY, value);
}

export async function persistTrackingActive(active: boolean) {
  await writeStore(TRACKING_ACTIVE_KEY, active ? '1' : '0');
}

export async function isPersistedTrackingActive() {
  return (await readStore(TRACKING_ACTIVE_KEY)) === '1';
}

export async function markLocationPingSent(at = Date.now()) {
  await writeStore(LAST_PING_KEY, String(at));
}

export function backgroundStartErrorMessage(reason: BackgroundLocationStartFailure) {
  switch (reason) {
    case 'unavailable':
      return 'Background GPS is not available in this build. Install a development or production build (not Expo Go).';
    case 'backgrounded':
      return 'Keep AFBEX open while starting tracking, then you can leave the app.';
    case 'services_off':
      return 'Turn on location services, then start tracking again.';
    case 'foreground_denied':
      return 'Allow location access, then start tracking again.';
    case 'background_denied':
      return 'Allow location all the time so tracking continues with the app closed and the screen off.';
    default:
      return 'Background GPS did not start. Allow location all the time, keep notifications on, then tap Start Tracking again.';
  }
}

async function getPingIntervalMs() {
  const raw = await readStore(PING_INTERVAL_KEY);
  const minutes = raw ? Number(raw) : DEFAULT_PING_MINUTES;
  if (!Number.isFinite(minutes)) return DEFAULT_PING_MINUTES * 60_000;
  return Math.min(Math.max(minutes, 1), 60) * 60_000;
}

async function getLastPingAt() {
  const raw = await readStore(LAST_PING_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function httpStatusOf(err: unknown) {
  if (err && typeof err === 'object' && 'status' in err) {
    return Number((err as { status: number }).status);
  }
  return 0;
}

function errorMessageOf(err: unknown) {
  if (err instanceof Error) return err.message;
  return '';
}

async function sendThrottledPing(latitude: number, longitude: number, accuracy?: number | null) {
  if (pingInFlight) return;
  if (!(await isPersistedTrackingActive())) return;
  const token = await getToken();
  if (!token) return;

  const apiBase = await ensureApiBaseReady();
  if (isPlaceholderApiBase(apiBase) && !__DEV__) return;

  const pingMs = await getPingIntervalMs();
  const lastPingAt = await getLastPingAt();
  const now = Date.now();
  if (lastPingAt != null && now - lastPingAt < pingMs - 5000) return;

  pingInFlight = true;
  try {
    await pingLocation(latitude, longitude, accuracy ?? undefined);
    await markLocationPingSent(Date.now());
  } catch (err) {
    const status = httpStatusOf(err);
    if (status === 429) {
      await markLocationPingSent(Date.now());
      return;
    }
    const msg = errorMessageOf(err).toLowerCase();
    const sessionOver =
      status === 401 ||
      status === 403 ||
      (status === 400 &&
        (msg.includes('clock') || msg.includes('shift ended') || msg.includes('not started')));
    if (sessionOver) {
      await persistTrackingActive(false);
      await stopBackgroundLocation();
    }
  } finally {
    pingInFlight = false;
  }
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.length ? locations[locations.length - 1] : null;
    const coords = latest?.coords;
    if (coords) {
      await sendThrottledPing(coords.latitude, coords.longitude, coords.accuracy);
      return;
    }
    const fallback = await Location.getLastKnownPositionAsync().catch(() => null);
    if (fallback?.coords) {
      await sendThrottledPing(
        fallback.coords.latitude,
        fallback.coords.longitude,
        fallback.coords.accuracy,
      );
    }
  } catch {
    // Headless task must not throw or Android will drop later updates.
  }
});

async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Foreground-service notification may still appear on older / OEM builds.
  }
}

async function promptUnrestrictedBatteryOnce() {
  if (Platform.OS !== 'android') return;
  const already = await readStore(BATTERY_PROMPTED_KEY);
  if (already === '1') return;
  await writeStore(BATTERY_PROMPTED_KEY, '1');
  const pkg = Constants.expoConfig?.android?.package ?? 'com.anonymous.afbex';
  try {
    await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
      { key: 'package', value: pkg },
    ]);
  } catch {
    // User can still exclude AFBEX from battery optimization in system settings.
  }
}

type PermissionFailure = 'services_off' | 'foreground_denied' | 'background_denied';

async function ensureLocationPermissions(): Promise<true | PermissionFailure> {
  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) return 'services_off';

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return 'foreground_denied';

  await requestNotificationPermission();
  if (Platform.OS === 'android') {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const background = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  const granted =
    background?.status === Location.PermissionStatus.GRANTED ||
    (await Location.getBackgroundPermissionsAsync()).status === Location.PermissionStatus.GRANTED;
  if (!granted) return 'background_denied';
  return true;
}

async function waitUntilAppActive(timeoutMs = 20_000): Promise<boolean> {
  if (AppState.currentState === 'active') return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      sub.remove();
      resolve(AppState.currentState === 'active');
    }, timeoutMs);
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      clearTimeout(timer);
      sub.remove();
      resolve(true);
    });
  });
}

const NATIVE_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.Balanced,
  timeInterval: NATIVE_GPS_INTERVAL_MS,
  distanceInterval: 0,
  deferredUpdatesInterval: 0,
  deferredUpdatesDistance: 0,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.OtherNavigation,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'AFBEX location tracking',
    notificationBody: 'Sharing your location during your shift.',
    notificationColor: '#1A3A3A',
    killServiceOnDestroy: false,
  },
  mayShowUserSettingsDialog: true,
};

export async function isBackgroundLocationRunning() {
  if (Platform.OS === 'web') return false;
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
}

export async function startBackgroundLocationResult(): Promise<BackgroundLocationStartResult> {
  if (Platform.OS === 'web') return { ok: false, reason: 'unavailable' };
  const available = await TaskManager.isAvailableAsync().catch(() => false);
  if (!available || !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    return { ok: false, reason: 'unavailable' };
  }

  const already = await isBackgroundLocationRunning();
  if (already) {
    await persistTrackingActive(true);
    return { ok: true };
  }

  // Android 12+ rejects starting a foreground service while backgrounded.
  if (AppState.currentState !== 'active') {
    return { ok: false, reason: 'backgrounded' };
  }

  const allowed = await ensureLocationPermissions();
  if (allowed !== true) {
    return { ok: false, reason: allowed };
  }

  const foreground = await waitUntilAppActive();
  if (!foreground) {
    return { ok: false, reason: 'backgrounded' };
  }

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, NATIVE_LOCATION_OPTIONS);
    const running = await isBackgroundLocationRunning();
    if (!running) {
      console.warn('AFBEX background location started but is not running');
      return { ok: false, reason: 'start_failed' };
    }
    await persistTrackingActive(true);
    void promptUnrestrictedBatteryOnce();
    return { ok: true };
  } catch (err) {
    const stillRunning = await isBackgroundLocationRunning();
    if (stillRunning) {
      await persistTrackingActive(true);
      return { ok: true };
    }
    if (AppState.currentState !== 'active') {
      return { ok: false, reason: 'backgrounded' };
    }
    console.warn('AFBEX background location failed to start', err);
    return { ok: false, reason: 'start_failed' };
  }
}

export async function startBackgroundLocation(): Promise<boolean> {
  return (await startBackgroundLocationResult()).ok;
}

export async function stopBackgroundLocation() {
  if (Platform.OS === 'web') return;
  await persistTrackingActive(false);
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Task may already be unregistered after clock-out / logout.
  }
}
