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
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/lib/backgroundLocation';
import { requestLocation } from '@/lib/location';

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
  const accuracyThresholdM = orgSettings?.location_accuracy_threshold_m ?? null;

  const refreshStatus = useCallback(async () => {
    if (status !== 'signedIn') {
      setTrackingActive(false);
      return;
    }
    const today = await getTodayStatus().catch(() => null);
    setTrackingActive(Boolean(today?.tracking_active));
  }, [status]);

  useEffect(() => {
    if (status !== 'signedIn') {
      setTrackingActive(false);
      return;
    }
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
    if (status === 'loading') return;
    if (status !== 'signedIn' || !trackingActive) {
      void stopBackgroundLocation().catch(() => undefined);
      return;
    }

    let cancelled = false;
    const pingMs = pingMinutes * 60_000;

    void startBackgroundLocation(pingMinutes).catch(() => undefined);

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
        const loc = await requestLocation();
        if (cancelled) return;
        if (
          accuracyThresholdM != null &&
          loc.accuracy != null &&
          loc.accuracy > accuracyThresholdM
        ) {
          return;
        }
        await pingLocation(loc.latitude, loc.longitude, loc.accuracy ?? undefined);
        lastPingAt.current = Date.now();
      } catch (err) {
        const httpStatus =
          err && typeof err === 'object' && 'status' in err
            ? Number((err as { status: number }).status)
            : 0;
        if (httpStatus === 429) return;
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
  }, [accuracyThresholdM, pingMinutes, status, trackingActive]);

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
