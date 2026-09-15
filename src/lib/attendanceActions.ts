import type { Href } from 'expo-router';
import { router } from 'expo-router';

import {
  clockIn,
  clockOut,
  endLocation,
  getEmployeeLiveDetail,
  startLocation,
  type AttendanceRecord,
} from '@/lib/api/attendance';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
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

/** After location consent / settings, return here — never bounce Home → Clock tab. */
export const HOME_RETURN = '/(app)';
export const CLOCK_RETURN = '/(app)/clock';

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

function hoursFromRange(inTime?: string | null, outTime?: string | null) {
  if (!inTime || !outTime) return 0;
  const ms = new Date(outTime).getTime() - new Date(inTime).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

/** Same pre-check Home + Clock use before clock-in / tracking / clock-out. */
export async function gateAttendanceLocation(returnTo: string): Promise<Href | null> {
  return routeForLocationAction(returnTo);
}

export async function executeClockIn(options?: {
  /** Where to resume after location consent / settings (Home or Clock tab). */
  returnTo?: string;
}): Promise<AttendanceActionResult<{ record: AttendanceRecord; loc: DeviceLocation }>> {
  const returnTo = options?.returnTo ?? CLOCK_RETURN;
  try {
    const loc = await requestLocation();
    const record = await clockIn(loc.latitude, loc.longitude, loc.address);
    return { ok: true, data: { record, loc } };
  } catch (err) {
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, returnTo) };
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
  returnTo?: string;
  /** Runs after GPS is resolved and before the clock-out API (e.g. capture live stats). */
  beforeCommit?: () => Promise<void>;
}): Promise<AttendanceActionResult<{ closed: AttendanceRecord; loc: DeviceLocation }>> {
  const returnTo = options?.returnTo ?? CLOCK_RETURN;
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
      return { ok: false, error: mapLocationCatch(err, returnTo) };
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

/**
 * Clock out + open shift-complete (same result from Home or Clock — never only jump to Clock tab).
 */
export async function executeClockOutToComplete(options: {
  userId?: string | null;
  returnTo?: string;
}): Promise<AttendanceActionResult<{ closed: AttendanceRecord; loc: DeviceLocation }>> {
  const returnTo = options.returnTo ?? CLOCK_RETURN;
  const captured: {
    distanceKm: number;
    visitsDone: number;
    visitsAssigned: number;
  } = { distanceKm: 0, visitsDone: 0, visitsAssigned: 0 };

  const result = await executeClockOut({
    returnTo,
    beforeCommit: async () => {
      const [liveDetail, visitResponse] = await Promise.all([
        options.userId
          ? getEmployeeLiveDetail(options.userId).catch(() => null)
          : Promise.resolve(null),
        getMyVisits().catch(() => null as { items: FieldVisit[]; total: number } | null),
      ]);
      captured.distanceKm = liveDetail?.distance_today_km ?? 0;
      captured.visitsDone =
        visitResponse?.items.filter((v) => v.status.toLowerCase() === 'completed').length ??
        liveDetail?.visits_completed ??
        0;
      captured.visitsAssigned =
        visitResponse?.total ??
        visitResponse?.items.length ??
        liveDetail?.visits_assigned ??
        0;
    },
  });

  if (!result.ok) return result;

  const { closed } = result.data;
  const outTime = closed.clock_out_time ?? new Date().toISOString();
  const hours = closed.working_hours ?? hoursFromRange(closed.clock_in_time, outTime);

  router.replace({
    pathname: '/shift-complete',
    params: {
      inTime: closed.clock_in_time,
      outTime,
      hours: String(hours),
      distance: String(captured.distanceKm),
      visitsDone: String(captured.visitsDone),
      visitsAssigned: String(captured.visitsAssigned),
      lock: closed.id.slice(0, 6).toUpperCase(),
    },
  });

  return result;
}

export async function executeStartTracking(
  pingMinutes: number,
  existingLoc?: DeviceLocation | null,
  returnTo: string = CLOCK_RETURN,
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
            returnTo,
          ),
        };
      }
      if (gps.reason === 'services_off') {
        return { ok: false, error: locationRequiredHref('off', returnTo) };
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
      return { ok: false, error: mapLocationCatch(err, returnTo) };
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
  returnTo: string = CLOCK_RETURN,
): Promise<AttendanceActionResult<{ loc: DeviceLocation }>> {
  try {
    const next = existingLoc ?? (await requestLocation());
    await endLocation(next.latitude, next.longitude, undefined, next.address);
    await forceStopBackgroundLocation().catch(() => undefined);
    return { ok: true, data: { loc: next } };
  } catch (err) {
    const code = locationErrorCode(err);
    if (code === 'services_off' || code === 'denied') {
      return { ok: false, error: mapLocationCatch(err, returnTo) };
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
