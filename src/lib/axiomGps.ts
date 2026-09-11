/**
 * Mobile → Axiom GPS observability.
 * Focus: clear failure reasons (why ping/tracking failed), not noisy GPS spam.
 */

import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_OPTIONS } from '@/lib/storage';

const EMPLOYEE_KEY = 'afbex.gps_log_employee_id';
const ORG_KEY = 'afbex.gps_log_org_id';
const NAME_KEY = 'afbex.gps_log_employee_name';

type GpsLogIdentity = {
  employeeId: string | null;
  organizationId: string | null;
  employeeName: string | null;
};

const identity: GpsLogIdentity = {
  employeeId: null,
  organizationId: null,
  employeeName: null,
};

let lastRuntimeFingerprint = '';
let lastRuntimeAt = 0;
let lastSkipWhyAt = 0;

const RUNTIME_MIN_INTERVAL_MS = 60_000;
const SKIP_LOG_MIN_INTERVAL_MS = 30_000;

/** Human-readable failure explanations for Axiom dashboards. */
export const GPS_WHY: Record<string, string> = {
  ok: 'Location tracking is healthy.',
  idle: 'Tracking is off — Start Tracking has not been pressed.',
  already_running: 'Native GPS was already running.',
  started: 'Native GPS started successfully.',
  started_after_throw: 'Native GPS is running after a start error recovery.',
  stopped: 'Tracking stopped by user or clock-out.',
  force_stopped: 'Tracking force-stopped (end tracking / logout).',
  unavailable:
    'Background GPS unavailable in this build. Use a development/production build (not Expo Go).',
  backgrounded: 'App was backgrounded while starting GPS. Keep AFBEX open, then start again.',
  services_off: 'Device location services are turned off.',
  foreground_denied: 'Foreground location permission denied.',
  background_denied: 'Background location ("Allow all the time") not granted.',
  start_failed: 'Native GPS failed to start (OEM/battery/permission issue).',
  start_failed_not_running: 'Start API succeeded but native updates are not running.',
  native_stopped_while_tracking:
    'Server/session says tracking is ON, but native GPS is OFF — battery kill / FGS stopped.',
  status_running: 'Heartbeat: native GPS is running.',
  status_not_running: 'Heartbeat: native GPS is NOT running while tracking expected.',
  status_idle: 'Tracking idle on server.',
  restart_after_status: 'App tried to restart native GPS after status check.',
  app_foreground: 'App returned to foreground; checked GPS runtime.',
  tracking_active: 'Tracking became active in app.',
  heartbeat: 'Periodic runtime check.',
  ping_lock: 'Skipped ping — previous ping still in flight.',
  tracking_not_active: 'Skipped ping — local tracking flag is off.',
  no_auth_token: 'FAILED: no auth token — user logged out or token cleared.',
  invalid_api_base: 'FAILED: API base URL missing/invalid — pings cannot reach backend.',
  client_throttled: 'Skipped ping — waiting for org ping interval (client throttle).',
  sent: 'Ping sent to backend successfully.',
  throttled_by_server: 'Backend rejected ping (429) — too soon after last recorded ping.',
  server_session_not_ready: 'FAILED: backend says location tracking was not started.',
  session_over: 'FAILED: shift ended / unauthorized — tracking stopped.',
  accuracy_exceeded: 'FAILED: GPS accuracy worse than org threshold — ping rejected.',
  ping_failed: 'FAILED: backend rejected the location ping.',
  unexpected_error: 'FAILED: unexpected client error while sending ping.',
  task_error: 'FAILED: native location task reported an error.',
  handler_crashed: 'FAILED: location task handler crashed.',
  no_coordinates: 'Native GPS callback had no coordinates.',
  network_error: 'FAILED: network error while sending ping to backend.',
};

function whyText(reason?: string | null, fallback?: string) {
  if (reason && GPS_WHY[reason]) return GPS_WHY[reason];
  return fallback || reason || 'Unknown GPS event.';
}

function axiomEnabled() {
  const enabled = (process.env.EXPO_PUBLIC_AXIOM_ENABLED ?? 'true').toLowerCase();
  if (enabled === 'false' || enabled === '0') return false;
  return Boolean(
    process.env.EXPO_PUBLIC_AXIOM_TOKEN?.trim() && process.env.EXPO_PUBLIC_AXIOM_DATASET?.trim(),
  );
}

function ingestUrl() {
  const edge = (process.env.EXPO_PUBLIC_AXIOM_EDGE_URL ?? 'https://us-east-1.aws.edge.axiom.co').replace(
    /\/$/,
    '',
  );
  const dataset = process.env.EXPO_PUBLIC_AXIOM_DATASET!.trim();
  return `${edge}/v1/ingest/${dataset}`;
}

async function readStore(key: string) {
  if (Platform.OS === 'web') return null;
  try {
    return await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    return null;
  }
}

async function writeStore(key: string, value: string) {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
  } catch {
    // ignore
  }
}

async function deleteStore(key: string) {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    // ignore
  }
}

/** Call after login / me bootstrap so headless GPS logs are attributable. */
export async function setGpsLogIdentity(input: {
  employeeId: string;
  organizationId?: string | null;
  employeeName?: string | null;
}) {
  identity.employeeId = input.employeeId;
  identity.organizationId = input.organizationId ?? null;
  identity.employeeName = input.employeeName ?? null;
  await Promise.all([
    writeStore(EMPLOYEE_KEY, input.employeeId),
    input.organizationId ? writeStore(ORG_KEY, input.organizationId) : deleteStore(ORG_KEY),
    input.employeeName ? writeStore(NAME_KEY, input.employeeName) : deleteStore(NAME_KEY),
  ]);
}

export async function clearGpsLogIdentity() {
  identity.employeeId = null;
  identity.organizationId = null;
  identity.employeeName = null;
  await Promise.all([deleteStore(EMPLOYEE_KEY), deleteStore(ORG_KEY), deleteStore(NAME_KEY)]);
}

async function warmIdentity() {
  if (identity.employeeId) return;
  const [employeeId, organizationId, employeeName] = await Promise.all([
    readStore(EMPLOYEE_KEY),
    readStore(ORG_KEY),
    readStore(NAME_KEY),
  ]);
  identity.employeeId = employeeId;
  identity.organizationId = organizationId;
  identity.employeeName = employeeName;
}

export type MobileGpsEvent =
  | 'location.runtime'
  | 'location.native_start'
  | 'location.native_stop'
  | 'location.ping_client'
  | 'location.permission'
  | 'location.task'
  | 'location.failure';

function levelFor(outcome: string, failed: boolean): 'info' | 'warn' | 'error' {
  if (failed || outcome === 'rejected' || outcome === 'error' || outcome === 'not_running') {
    if (outcome === 'not_running') return 'warn';
    return 'error';
  }
  if (outcome === 'skipped') return 'warn';
  return 'info';
}

export async function emitMobileGpsLog(input: {
  event: MobileGpsEvent;
  outcome: string;
  detail?: string;
  reason?: string;
  why?: string;
  nativeRunning?: boolean;
  trackingActive?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  statusCode?: number | null;
  force?: boolean;
  failed?: boolean;
  [key: string]: unknown;
}) {
  if (!axiomEnabled()) return;

  try {
    await warmIdentity();
    const {
      event,
      outcome,
      detail,
      reason,
      why,
      nativeRunning,
      trackingActive,
      latitude,
      longitude,
      accuracyMeters,
      statusCode,
      force: _force,
      failed,
      ...extra
    } = input;

    const isFailed =
      failed ??
      (outcome === 'rejected' ||
        outcome === 'error' ||
        reason === 'native_stopped_while_tracking' ||
        (outcome === 'not_running' && trackingActive === true));

    const payload = {
      _time: new Date().toISOString(),
      app: 'afbex-mobile',
      source: 'mobile',
      domain: 'gps_tracking',
      event,
      outcome,
      reason: reason ?? null,
      why: why ?? whyText(reason, detail),
      detail: detail ?? why ?? whyText(reason),
      failed: Boolean(isFailed),
      level: levelFor(outcome, Boolean(isFailed)),
      native_running: nativeRunning ?? null,
      tracking_active: trackingActive ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      accuracy_meters: accuracyMeters ?? null,
      status_code: statusCode ?? null,
      employee_id: identity.employeeId,
      organization_id: identity.organizationId,
      employee_name: identity.employeeName,
      platform: Platform.OS,
      platform_version: String(Platform.Version),
      app_version: Constants.expoConfig?.version ?? null,
      app_state: AppState.currentState,
      ...extra,
    };

    const token = process.env.EXPO_PUBLIC_AXIOM_TOKEN!.trim();
    void fetch(ingestUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([payload]),
    }).catch(() => undefined);
  } catch {
    // Never break GPS because of logging.
  }
}

/** Explicit failure log — use for anything that prevents a ping being stored. */
export async function logGpsFailure(input: {
  reason: string;
  detail?: string;
  why?: string;
  statusCode?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  trackingActive?: boolean;
  nativeRunning?: boolean;
  remaining_ms?: number | null;
  [key: string]: unknown;
}) {
  const {
    reason,
    detail,
    why,
    statusCode,
    latitude,
    longitude,
    accuracyMeters,
    trackingActive,
    nativeRunning,
    ...extra
  } = input;

  await emitMobileGpsLog({
    event: 'location.failure',
    outcome: 'rejected',
    reason,
    why: why ?? whyText(reason, detail),
    detail: detail ?? whyText(reason),
    statusCode,
    latitude,
    longitude,
    accuracyMeters,
    trackingActive,
    nativeRunning,
    failed: true,
    force: true,
    ...extra,
  });
}

/**
 * Emit when native GPS is running or not.
 * Dedupes identical state for 60s unless `force` is set.
 */
export async function reportGpsRuntimeStatus(input: {
  trackingActive: boolean;
  nativeRunning: boolean;
  detail?: string;
  reason?: string;
  force?: boolean;
}) {
  const fingerprint = `${input.trackingActive}:${input.nativeRunning}`;
  const now = Date.now();
  const changed = fingerprint !== lastRuntimeFingerprint;
  if (!input.force && !changed && now - lastRuntimeAt < RUNTIME_MIN_INTERVAL_MS) {
    return;
  }
  lastRuntimeFingerprint = fingerprint;
  lastRuntimeAt = now;

  const running = input.nativeRunning;
  const mismatch = input.trackingActive && !input.nativeRunning;
  const reason =
    input.reason ?? (mismatch ? 'native_stopped_while_tracking' : running ? 'ok' : 'idle');

  await emitMobileGpsLog({
    event: 'location.runtime',
    outcome: running ? 'running' : 'not_running',
    reason,
    why: whyText(
      mismatch ? 'native_stopped_while_tracking' : reason,
      input.detail,
    ),
    detail:
      input.detail ??
      (mismatch
        ? 'Tracking ON but native GPS OFF — this is why pings stop on some devices.'
        : running
          ? 'Native location updates are running.'
          : 'Native location updates are not running.'),
    nativeRunning: input.nativeRunning,
    trackingActive: input.trackingActive,
    force: true,
    failed: mismatch,
    mismatch,
  });

  if (mismatch) {
    await logGpsFailure({
      reason: 'native_stopped_while_tracking',
      detail: 'Tracking session active but native GPS service is not running.',
      trackingActive: true,
      nativeRunning: false,
    });
  }
}

/** Rate-limited skip log (client throttle / lock) so Axiom shows why pings are delayed. */
export async function logGpsSkipWhy(input: {
  reason: string;
  detail?: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  remainingMs?: number;
}) {
  const now = Date.now();
  if (now - lastSkipWhyAt < SKIP_LOG_MIN_INTERVAL_MS) return;
  lastSkipWhyAt = now;

  const remainingMin =
    input.remainingMs != null ? Math.max(0, Math.ceil(input.remainingMs / 60_000)) : null;

  await emitMobileGpsLog({
    event: 'location.ping_client',
    outcome: 'skipped',
    reason: input.reason,
    why: whyText(
      input.reason,
      remainingMin != null
        ? `Waiting ~${remainingMin} min before next ping (org interval).`
        : undefined,
    ),
    detail:
      input.detail ??
      (remainingMin != null
        ? `Client throttle: next ping in ~${remainingMin} min (${input.remainingMs} ms).`
        : whyText(input.reason)),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracyMeters,
    remaining_ms: input.remainingMs ?? null,
    failed: false,
    force: true,
  });
}

/** Map backend error text → stable reason + why. */
export function classifyPingServerError(status: number, message: string) {
  const msg = message.toLowerCase();
  if (status === 429) {
    return { reason: 'throttled_by_server', why: GPS_WHY.throttled_by_server };
  }
  if (msg.includes('accuracy') && msg.includes('threshold')) {
    return { reason: 'accuracy_exceeded', why: message || GPS_WHY.accuracy_exceeded };
  }
  if (
    msg.includes('not started') ||
    msg.includes('tracking was not started') ||
    msg.includes('location tracking was not started')
  ) {
    return { reason: 'server_session_not_ready', why: message || GPS_WHY.server_session_not_ready };
  }
  if (
    status === 401 ||
    (status === 400 &&
      (msg.includes('clock') || msg.includes('shift ended') || msg.includes('clocked out')))
  ) {
    return { reason: 'session_over', why: message || GPS_WHY.session_over };
  }
  if (status === 403) {
    return { reason: 'session_over', why: message || GPS_WHY.session_over };
  }
  if (!status || status === 0 || msg.includes('network') || msg.includes('timeout')) {
    return { reason: 'network_error', why: message || GPS_WHY.network_error };
  }
  return { reason: 'ping_failed', why: message || GPS_WHY.ping_failed };
}
