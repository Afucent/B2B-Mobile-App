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
/** Fallback only when org settings have not been loaded yet (portal default is often 10). */
const DEFAULT_PING_MINUTES = 10;
/** Native GPS wake interval; server pings remain throttled to the org interval (min 1 min). */
const NATIVE_GPS_INTERVAL_MS = 15_000;
const LOG_PREFIX = '[AFBEX-GPS]';

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

type SessionCache = {
  trackingActive: boolean | null;
  pingIntervalMs: number | null;
  lastPingAt: number | null;
};

const session: SessionCache = {
  trackingActive: null,
  pingIntervalMs: null,
  lastPingAt: null,
};

/**
 * Boolean in-flight flags break when the app backgrounds mid-fetch: RN may pause timers,
 * so AbortController never fires and every native GPS callback is dropped.
 * Use a TTL lock + generation id instead.
 */
const PING_LOCK_TTL_MS = 15_000;
let pingLockUntil = 0;
let pingGeneration = 0;
let pendingPing: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
} | null = null;
let lastSkipLogAt = 0;

/** Prevents refreshStatus from stopping GPS while Start Tracking is still finishing. */
let trackingStartGate = 0;

void getPersistedApiBase()
  .then((url) => {
    if (url) hydrateApiBaseCache(url);
  })
  .catch(() => undefined);

export function beginTrackingStartGate() {
  trackingStartGate += 1;
}

export function endTrackingStartGate() {
  trackingStartGate = Math.max(0, trackingStartGate - 1);
}

export function isTrackingStartInProgress() {
  return trackingStartGate > 0;
}

function logGps(message: string, detail?: unknown) {
  if (detail !== undefined) {
    console.warn(LOG_PREFIX, message, detail);
    return;
  }
  console.warn(LOG_PREFIX, message);
}

/** Rate-limit noisy skip logs so Metro stays readable. */
function logGpsSkip(message: string, detail?: unknown) {
  const now = Date.now();
  if (now - lastSkipLogAt < 8_000) return;
  lastSkipLogAt = now;
  logGps(message, detail);
}

function isPingLocked(now = Date.now()) {
  return now < pingLockUntil;
}

function acquirePingLock(now = Date.now()) {
  pingGeneration += 1;
  pingLockUntil = now + PING_LOCK_TTL_MS;
  return pingGeneration;
}

function releasePingLock(generation: number) {
  if (generation !== pingGeneration) return;
  pingLockUntil = 0;
}

async function readStore(key: string) {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (err) {
    logGps(`SecureStore read failed for ${key}`, err);
    return null;
  }
}

async function writeStore(key: string, value: string) {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
  } catch (err) {
    logGps(`SecureStore write failed for ${key}`, err);
  }
}

function clampPingMinutes(minutes: number) {
  if (!Number.isFinite(minutes)) return DEFAULT_PING_MINUTES;
  return Math.min(Math.max(Math.round(minutes), 1), 60);
}

export async function persistPingIntervalMinutes(minutes: number) {
  const value = clampPingMinutes(minutes);
  session.pingIntervalMs = value * 60_000;
  await writeStore(PING_INTERVAL_KEY, String(value));
}

export async function persistTrackingActive(active: boolean) {
  session.trackingActive = active;
  await writeStore(TRACKING_ACTIVE_KEY, active ? '1' : '0');
}

export async function isPersistedTrackingActive() {
  if (session.trackingActive != null) return session.trackingActive;
  const active = (await readStore(TRACKING_ACTIVE_KEY)) === '1';
  session.trackingActive = active;
  return active;
}

export async function markLocationPingSent(at = Date.now()) {
  session.lastPingAt = at;
  await writeStore(LAST_PING_KEY, String(at));
}

/** Warm in-memory session used by the headless GPS task (call while app is foreground). */
export async function warmBackgroundTrackingSession() {
  try {
    const [token, apiBase, activeRaw, intervalRaw, lastRaw] = await Promise.all([
      getToken().catch(() => null),
      ensureApiBaseReady().catch(() => ''),
      readStore(TRACKING_ACTIVE_KEY),
      readStore(PING_INTERVAL_KEY),
      readStore(LAST_PING_KEY),
    ]);

    if (apiBase) hydrateApiBaseCache(apiBase);
    if (activeRaw != null) session.trackingActive = activeRaw === '1';
    if (intervalRaw != null) {
      const minutes = clampPingMinutes(Number(intervalRaw));
      session.pingIntervalMs = minutes * 60_000;
    }
    if (lastRaw != null) {
      const value = Number(lastRaw);
      session.lastPingAt = Number.isFinite(value) ? value : null;
    }

    logGps('session warmed', {
      hasToken: Boolean(token),
      trackingActive: session.trackingActive,
      pingIntervalMs: session.pingIntervalMs,
    });
  } catch (err) {
    logGps('session warm failed', err);
  }
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
  if (session.pingIntervalMs != null) return session.pingIntervalMs;
  const raw = await readStore(PING_INTERVAL_KEY);
  const minutes = clampPingMinutes(raw ? Number(raw) : DEFAULT_PING_MINUTES);
  session.pingIntervalMs = minutes * 60_000;
  return session.pingIntervalMs;
}

async function getLastPingAt() {
  if (session.lastPingAt != null) return session.lastPingAt;
  const raw = await readStore(LAST_PING_KEY);
  const value = raw ? Number(raw) : NaN;
  session.lastPingAt = Number.isFinite(value) ? value : null;
  return session.lastPingAt;
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

/**
 * Shared throttle used by the native background task (source of truth) and rare foreground catch-up.
 * Lock uses TTL so a paused JS runtime while backgrounded cannot block later GPS callbacks forever.
 */
export async function sendThrottledTrackingPing(
  latitude: number,
  longitude: number,
  accuracy?: number | null,
  force = false,
) {
  const now = Date.now();

  if (isPingLocked(now)) {
    pendingPing = { latitude, longitude, accuracy };
    logGpsSkip('skip: ping lock held (queued latest coords)');
    return false;
  }

  try {
    if (!(await isPersistedTrackingActive())) {
      logGpsSkip('skip: tracking not active');
      return false;
    }

    const token = await getToken().catch(() => null);
    if (!token) {
      logGps('skip: no auth token');
      return false;
    }

    const apiBase = await ensureApiBaseReady().catch(() => '');
    if (!apiBase || (isPlaceholderApiBase(apiBase) && !__DEV__)) {
      logGps('skip: invalid API base', apiBase || '(empty)');
      return false;
    }

    const pingMs = await getPingIntervalMs();
    const lastPingAt = await getLastPingAt();
    const checkedAt = Date.now();
    if (!force && lastPingAt != null && checkedAt - lastPingAt < pingMs - 5000) {
      pendingPing = { latitude, longitude, accuracy };
      logGpsSkip('skip: throttled', { remainingMs: pingMs - (checkedAt - lastPingAt) });
      return false;
    }

    const generation = acquirePingLock(checkedAt);
    pendingPing = null;
    try {
      await pingLocation(latitude, longitude, accuracy ?? undefined);
      if (generation !== pingGeneration) return false;
      await markLocationPingSent(Date.now());
      logGps('ping_ok', { latitude, longitude, accuracy });
      return true;
    } catch (err) {
      if (generation !== pingGeneration) return false;
      const status = httpStatusOf(err);
      if (status === 429) {
        await markLocationPingSent(Date.now());
        logGps('ping_throttled_by_server');
        return false;
      }
      const msg = errorMessageOf(err).toLowerCase();
      const serverSessionNotReady =
        (status === 400 || status === 403 || status === 409) &&
        (msg.includes('not started') ||
          msg.includes('tracking was not started') ||
          msg.includes('location tracking was not started'));
      if (serverSessionNotReady) {
        logGps('ping_fail: server session not ready yet', { status, message: errorMessageOf(err) });
        return false;
      }
      const sessionOver =
        status === 401 ||
        status === 403 ||
        (status === 400 &&
          (msg.includes('clock') || msg.includes('shift ended') || msg.includes('clocked out')));
      logGps('ping_fail', { status, message: errorMessageOf(err) });
      if (sessionOver && !isTrackingStartInProgress()) {
        await persistTrackingActive(false);
        await stopBackgroundLocation().catch(() => undefined);
      }
      return false;
    } finally {
      releasePingLock(generation);
      void flushPendingPingIfDue();
    }
  } catch (err) {
    logGps('ping unexpected error', err);
    pingLockUntil = 0;
    return false;
  }
}

async function flushPendingPingIfDue() {
  const queued = pendingPing;
  if (!queued) return;
  if (isPingLocked()) return;
  try {
    const pingMs = await getPingIntervalMs();
    const lastPingAt = await getLastPingAt();
    const now = Date.now();
    if (lastPingAt != null && now - lastPingAt < pingMs - 5000) return;
    pendingPing = null;
    await sendThrottledTrackingPing(queued.latitude, queued.longitude, queued.accuracy, false);
  } catch (err) {
    logGps('pending ping flush failed', err);
  }
}

/** Foreground catch-up when returning to the app — does not run a competing timer loop. */
export async function sendCatchUpTrackingPingIfDue() {
  try {
    if (!(await isPersistedTrackingActive())) return;
    if (isPingLocked()) return;
    const pingMs = await getPingIntervalMs();
    const lastPingAt = await getLastPingAt();
    const now = Date.now();
    if (lastPingAt != null && now - lastPingAt < pingMs - 5000) return;

    const position =
      (await Location.getLastKnownPositionAsync().catch(() => null)) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(
        () => null,
      ));
    if (!position?.coords) return;
    await sendThrottledTrackingPing(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy,
      false,
    );
  } catch (err) {
    logGps('catch-up ping failed', err);
  }
}

/** Call only after `/attendance/location/start` has succeeded. */
export async function sendImmediateStartupPing() {
  try {
    if (!(await isPersistedTrackingActive())) {
      logGps('startup ping skipped: tracking not active');
      return;
    }
    const position =
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null)) ?? (await Location.getLastKnownPositionAsync().catch(() => null));
    if (!position?.coords) {
      logGps('startup ping skipped: no position yet');
      return;
    }
    await sendThrottledTrackingPing(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy,
      true,
    );
  } catch (err) {
    logGps('startup ping failed', err);
  }
}

/** Opens battery settings after tracking is up — never during FGS start (would background the app). */
export function scheduleBatteryOptimizationPrompt() {
  if (Platform.OS !== 'android') return;
  setTimeout(() => {
    if (AppState.currentState !== 'active') return;
    void promptUnrestrictedBatteryOnce();
  }, 2500);
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  try {
    if (error) {
      logGps('task error', error);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.length ? locations[locations.length - 1] : null;
    const coords = latest?.coords;
    if (coords) {
      await sendThrottledTrackingPing(coords.latitude, coords.longitude, coords.accuracy);
      return;
    }
    const fallback = await Location.getLastKnownPositionAsync().catch(() => null);
    if (fallback?.coords) {
      await sendThrottledTrackingPing(
        fallback.coords.latitude,
        fallback.coords.longitude,
        fallback.coords.accuracy,
      );
      return;
    }
    logGps('task update with no coordinates');
  } catch (err) {
    // Headless task must not throw or Android will drop later updates.
    logGps('task handler crashed (swallowed)', err);
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
  try {
    const already = await readStore(BATTERY_PROMPTED_KEY);
    if (already === '1') return;
    await writeStore(BATTERY_PROMPTED_KEY, '1');
    const pkg = Constants.expoConfig?.android?.package ?? 'com.anonymous.afbex';
    await Linking.sendIntent('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', [
      { key: 'package', value: pkg },
    ]);
  } catch {
    // User can still exclude AFBEX from battery optimization in system settings.
  }
}

type PermissionFailure = 'services_off' | 'foreground_denied' | 'background_denied';

async function ensureLocationPermissions(): Promise<true | PermissionFailure> {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) return 'services_off';

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return 'foreground_denied';

    await requestNotificationPermission();
    if (Platform.OS === 'android') {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    const background = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    const currentBg = await Location.getBackgroundPermissionsAsync().catch(() => null);
    const granted =
      background?.status === Location.PermissionStatus.GRANTED ||
      currentBg?.status === Location.PermissionStatus.GRANTED;
    if (!granted) return 'background_denied';
    return true;
  } catch (err) {
    logGps('permission check failed', err);
    return 'foreground_denied';
  }
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
  accuracy: Location.Accuracy.High,
  timeInterval: NATIVE_GPS_INTERVAL_MS,
  distanceInterval: 1,
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

  try {
    const available = await TaskManager.isAvailableAsync().catch(() => false);
    if (!available || !TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
      return { ok: false, reason: 'unavailable' };
    }

    await warmBackgroundTrackingSession();

    const already = await isBackgroundLocationRunning();
    if (already) {
      await persistTrackingActive(true);
      logGps('already running');
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
        logGps('started but hasStartedLocationUpdatesAsync=false');
        return { ok: false, reason: 'start_failed' };
      }
      await persistTrackingActive(true);
      await warmBackgroundTrackingSession();
      logGps('native location updates started');
      return { ok: true };
    } catch (err) {
      const stillRunning = await isBackgroundLocationRunning();
      if (stillRunning) {
        await persistTrackingActive(true);
        await warmBackgroundTrackingSession();
        logGps('start threw but updates are running', err);
        return { ok: true };
      }
      if (AppState.currentState !== 'active') {
        return { ok: false, reason: 'backgrounded' };
      }
      logGps('failed to start', err);
      return { ok: false, reason: 'start_failed' };
    }
  } catch (err) {
    logGps('startBackgroundLocationResult unexpected', err);
    return { ok: false, reason: 'start_failed' };
  }
}

export async function startBackgroundLocation(): Promise<boolean> {
  return (await startBackgroundLocationResult()).ok;
}

export async function stopBackgroundLocation() {
  if (Platform.OS === 'web') return;
  if (isTrackingStartInProgress()) {
    logGps('stop deferred: start still in progress');
    return;
  }
  await persistTrackingActive(false);
  session.lastPingAt = null;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      logGps('native location updates stopped');
    }
  } catch (err) {
    // Task may already be unregistered after clock-out / logout.
    logGps('stop ignored', err);
  }
}

/** Force-stop used by End Tracking / logout even if a start gate was left open. */
export async function forceStopBackgroundLocation() {
  trackingStartGate = 0;
  await persistTrackingActive(false);
  session.lastPingAt = null;
  if (Platform.OS === 'web') return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      logGps('native location updates force-stopped');
    }
  } catch (err) {
    logGps('force-stop ignored', err);
  }
}
