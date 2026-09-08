import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useFieldOpsSettings } from '@/context/FieldOpsSettingsContext';
import { getTodayStatus, pingLocation } from '@/lib/api/attendance';
import {
  isPersistedTrackingActive,
  markLocationPingSent,
  persistPingIntervalMinutes,
  persistTrackingActive,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/lib/backgroundLocation';
import { getLastKnownLocation, requestLocation } from '@/lib/location';

type TrackingContextValue = {
  trackingActive: boolean;
  pingMinutes: number;
  refreshStatus: () => Promise<void>;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

const DEFAULT_PING_MINUTES = 20;

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { settings: orgSettings, refreshSettings } = useFieldOpsSettings();
  const [trackingActive, setTrackingActive] = useState(false);
  const pingInFlight = useRef(false);
  const lastPingAt = useRef<number | null>(null);

  const pingMinutes = Math.min(
    Math.max(orgSettings?.gps_ping_interval_minutes ?? DEFAULT_PING_MINUTES, 1),
    60,
  );

  const refreshStatus = useCallback(async () => {
    if (status !== 'signedIn') return;
    const today = await getTodayStatus().catch(() => null);
    // Network failure must not stop GPS while the screen is off.
    if (!today) return;
    const active = Boolean(today.tracking_active);
    setTrackingActive(active);
    if (active) {
      await persistTrackingActive(true);
      await startBackgroundLocation();
    } else {
      await persistTrackingActive(false);
      await stopBackgroundLocation();
    }
  }, [status]);

  useEffect(() => {
    void persistPingIntervalMinutes(pingMinutes);
  }, [pingMinutes]);

  useEffect(() => {
    void isPersistedTrackingActive().then((active) => {
      if (!active) return;
      setTrackingActive(true);
      void startBackgroundLocation();
    });
  }, []);

  useEffect(() => {
    if (status === 'signedOut') {
      setTrackingActive(false);
      void persistTrackingActive(false);
      void stopBackgroundLocation();
      return;
    }
    if (status !== 'signedIn') return;
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 60_000);
    return () => clearInterval(id);
  }, [refreshStatus, status]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    void refreshSettings();
    const id = setInterval(() => void refreshSettings(), 5 * 60_000);
    return () => clearInterval(id);
  }, [refreshSettings, status]);

  useEffect(() => {
    if (status !== 'signedIn') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshSettings();
        void refreshStatus();
      }
    });
    return () => sub.remove();
  }, [refreshSettings, refreshStatus, status]);

  useEffect(() => {
    if (status === 'signedOut') return;
    if (!trackingActive) return;

    void startBackgroundLocation();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void startBackgroundLocation();
    });
    return () => sub.remove();
  }, [status, trackingActive]);

  useEffect(() => {
    if (status !== 'signedIn' || !trackingActive) return;

    let cancelled = false;
    const pingMs = pingMinutes * 60_000;

    async function sendPing(force = false) {
      if (pingInFlight.current || cancelled) return;
      const now = Date.now();
      if (
        !force &&
        lastPingAt.current != null &&
        now - lastPingAt.current < pingMs - 5000
      ) {
        return;
      }
      pingInFlight.current = true;
      try {
        const loc =
          (await requestLocation().catch(() => null)) ?? (await getLastKnownLocation());
        if (cancelled || !loc) return;
        await pingLocation(loc.latitude, loc.longitude, loc.accuracy ?? undefined);
        lastPingAt.current = Date.now();
        await markLocationPingSent(lastPingAt.current);
      } catch (err) {
        const httpStatus =
          err && typeof err === 'object' && 'status' in err
            ? Number((err as { status: number }).status)
            : 0;
        if (httpStatus === 429) {
          lastPingAt.current = Date.now();
          await markLocationPingSent(lastPingAt.current);
        }
      } finally {
        pingInFlight.current = false;
      }
    }

    void sendPing(true);
    const timer = setInterval(() => void sendPing(), pingMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pingMinutes, status, trackingActive]);

  const value = useMemo(
    () => ({
      trackingActive,
      pingMinutes,
      refreshStatus,
    }),
    [refreshStatus, pingMinutes, trackingActive],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('useTracking must be used within TrackingProvider');
  }
  return ctx;
}
