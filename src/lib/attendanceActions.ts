import type { Href } from 'expo-router';

import {
  clockIn,
  clockOut,
  endLocation,
  startLocation,
  type AttendanceRecord,
} from '@/lib/api/attendance';
import {
  backgroundStartErrorMessage,
  beginTrackingStartGate,
  endTrackingStartGate,
  forceStopBackgroundLocation,
  isBackgroundLocationRunning,
  persistPingIntervalMinutes,
  persistTrackingActive,
  scheduleBatteryOptimizationPrompt,
  sendImmediateStartupPing,
  startBackgroundLocationResult,
  warmBackgroundTrackingSession,
} from '@/lib/backgroundLocation';
import { requestLocation, type DeviceLocation } from '@/lib/location';
import { routeForLocationAction } from '@/lib/locationGate';

export type AttendanceLocationBlock = {
  kind: 'navigate';
  href: Href;
};

export type AttendanceActionFailure =
  | AttendanceLocationBlock
  | { kind: 'already_clocked_in' }
  | { kind: 'message'; message: string };

export type AttendanceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AttendanceActionFailure };

function locationErrorCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
}

function locationRequiredHref(
  reason: 'off' | 'denied' | 'background',
  next: string,
): AttendanceLocationBlock {
  return {
    kind: 'navigate',
    href: { pathname: '/location-required', params: { reason, next } } as Href,
  };
}

function mapLocationCatch(err: unknown, next: string): AttendanceActionFailure {
  const code = locationErrorCode(err);
  if (code === 'services_off') return locationRequiredHref('off', next);
  if (code === 'denied') return locationRequiredHref('denied', next);
  return {
    kind: 'message',
    message: err instanceof Error ? err.message : 'Location is required for this action.',
  };
}

/** Same pre-check the Clock tab uses before opening clock-in / tracking / clock-out. */
export async function gateAttendanceLocation(next: string): Promise<Href | null> {
  return routeForLocationAction(next);
}

export async function executeClockIn(): Promise<
  AttendanceActionResult<{ record: AttendanceRecord; loc: DeviceLocation }>
> {
  try {
    const loc = await requestLocation();
    const record = await clockIn(loc.latitude, loc.longitude, loc.address);
    return { ok: true, data: { record, loc } };
  } catch (err) {
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, '/clock-in') };
    }
    const message = err instanceof Error ? err.message : 'Clock-in failed.';
    if (message.toLowerCase().includes('already clocked in')) {
      return { ok: false, error: { kind: 'already_clocked_in' } };
    }
    return { ok: false, error: { kind: 'message', message } };
  }
}

export async function executeClockOut(options?: {
  loc?: DeviceLocation | null;
  /** Runs after GPS is resolved and before the clock-out API (e.g. capture live stats). */
  beforeCommit?: () => Promise<void>;
}): Promise<AttendanceActionResult<{ closed: AttendanceRecord; loc: DeviceLocation }>> {
  try {
    const loc = options?.loc ?? (await requestLocation());
    if (options?.beforeCommit) {
      await options.beforeCommit();
    }
    const closed = await clockOut(loc.latitude, loc.longitude, loc.address);
    await forceStopBackgroundLocation().catch(() => undefined);
    return { ok: true, data: { closed, loc } };
  } catch (err) {
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, '/clock-out') };
    }
    return {
      ok: false,
      error: {
        kind: 'message',
        message: err instanceof Error ? err.message : 'Clock-out failed.',
      },
    };
  }
}

export async function executeStartTracking(
  pingMinutes: number,
  existingLoc?: DeviceLocation | null,
): Promise<AttendanceActionResult<{ loc: DeviceLocation }>> {
  beginTrackingStartGate();
  try {
    const next = existingLoc ?? (await requestLocation());
    await persistPingIntervalMinutes(pingMinutes);
    await warmBackgroundTrackingSession();

    // Server session must exist before any location-ping (otherwise API returns 403).
    await startLocation(next.latitude, next.longitude, undefined, next.address);
    await persistTrackingActive(true);

    const gps = await startBackgroundLocationResult();
    if (!gps.ok) {
      await forceStopBackgroundLocation().catch(() => undefined);
      await endLocation(next.latitude, next.longitude, undefined, next.address).catch(() => undefined);
      if (gps.reason === 'background_denied' || gps.reason === 'foreground_denied') {
        return {
          ok: false,
          error: locationRequiredHref(
            gps.reason === 'background_denied' ? 'background' : 'denied',
            '/start-tracking',
          ),
        };
      }
      if (gps.reason === 'services_off') {
        return { ok: false, error: locationRequiredHref('off', '/start-tracking') };
      }
      return {
        ok: false,
        error: { kind: 'message', message: backgroundStartErrorMessage(gps.reason) },
      };
    }

    const nativeRunning = await isBackgroundLocationRunning();
    if (!nativeRunning) {
      await forceStopBackgroundLocation().catch(() => undefined);
      await endLocation(next.latitude, next.longitude, undefined, next.address).catch(() => undefined);
      return {
        ok: false,
        error: { kind: 'message', message: backgroundStartErrorMessage('start_failed') },
      };
    }

    await sendImmediateStartupPing();
    scheduleBatteryOptimizationPrompt();
    return { ok: true, data: { loc: next } };
  } catch (err) {
    await forceStopBackgroundLocation().catch(() => undefined);
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, '/start-tracking') };
    }
    return {
      ok: false,
      error: {
        kind: 'message',
        message: err instanceof Error ? err.message : 'Unable to start tracking.',
      },
    };
  } finally {
    endTrackingStartGate();
  }
}

export async function executeEndTracking(
  existingLoc?: DeviceLocation | null,
): Promise<AttendanceActionResult<{ loc: DeviceLocation }>> {
  try {
    const next = existingLoc ?? (await requestLocation());
    await endLocation(next.latitude, next.longitude, undefined, next.address);
    await forceStopBackgroundLocation().catch(() => undefined);
    return { ok: true, data: { loc: next } };
  } catch (err) {
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, '/start-tracking') };
    }
    return {
      ok: false,
      error: {
        kind: 'message',
        message: err instanceof Error ? err.message : 'Unable to end tracking.',
      },
    };
  }
}
