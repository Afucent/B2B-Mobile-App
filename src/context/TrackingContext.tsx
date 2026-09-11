import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useFieldOpsSettings } from '@/context/FieldOpsSettingsContext';
import { getTodayStatus } from '@/lib/api/attendance';
import {
  forceStopBackgroundLocation,
  isBackgroundLocationRunning,
  isPersistedTrackingActive,
  isTrackingStartInProgress,
  persistPingIntervalMinutes,
  persistTrackingActive,
  publishGpsRuntimeStatus,
  sendCatchUpTrackingPingIfDue,
  startBackgroundLocation,
  stopBackgroundLocation,
  warmBackgroundTrackingSession,
} from '@/lib/backgroundLocation';

type TrackingContextValue = {
  trackingActive: boolean;
  pingMinutes: number;
  refreshStatus: () => Promise<void>;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

/** Fallback only when org settings are not loaded yet. */
const DEFAULT_PING_MINUTES = 10;

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const { settings: orgSettings, refreshSettings } = useFieldOpsSettings();
  const [trackingActive, setTrackingActive] = useState(false);

  const pingMinutes = Math.min(
    Math.max(orgSettings?.gps_ping_interval_minutes ?? DEFAULT_PING_MINUTES, 1),
    60,
  );

  const refreshStatus = useCallback(async () => {
    if (status !== 'signedIn') return;
    try {
      const today = await getTodayStatus().catch(() => null);
      // Network failure must not stop GPS while the screen is off.
      if (!today) return;

      const active = Boolean(today.tracking_active);

      if (active) {
        setTrackingActive(true);
        await persistTrackingActive(true);
        await warmBackgroundTrackingSession();
        const running = await isBackgroundLocationRunning();
        await publishGpsRuntimeStatus(running ? 'status_running' : 'status_not_running');
        if (!running && AppState.currentState === 'active') {
          await startBackgroundLocation();
          await publishGpsRuntimeStatus('restart_after_status');
        }
        return;
      }

      // Do not fight an in-progress Start Tracking (server not updated yet).
      if (isTrackingStartInProgress()) {
        return;
      }

      setTrackingActive(false);
      await persistTrackingActive(false);
      await stopBackgroundLocation();
      await publishGpsRuntimeStatus('status_idle');
    } catch {
      // Keep existing tracking state on unexpected errors.
    }
  }, [status]);

  useEffect(() => {
    void persistPingIntervalMinutes(pingMinutes).catch(() => undefined);
  }, [pingMinutes]);

  useEffect(() => {
    void isPersistedTrackingActive()
      .then((active) => {
        if (!active) return;
        setTrackingActive(true);
        void warmBackgroundTrackingSession();
        if (AppState.currentState === 'active') {
          void startBackgroundLocation();
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (status === 'signedOut') {
      setTrackingActive(false);
      void forceStopBackgroundLocation();
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
      if (next !== 'active') return;
      void refreshSettings();
      void refreshStatus();
      void publishGpsRuntimeStatus('app_foreground');
      if (trackingActive) {
        void warmBackgroundTrackingSession();
        void startBackgroundLocation();
        void sendCatchUpTrackingPingIfDue();
      }
    });
    return () => sub.remove();
  }, [refreshSettings, refreshStatus, status, trackingActive]);

  // Ensure native FGS is running when tracking becomes active (start only while foreground-eligible).
  // Native TaskManager is the only ping source in background — no JS interval.
  useEffect(() => {
    if (status === 'signedOut' || !trackingActive) return;
    void warmBackgroundTrackingSession();
    if (AppState.currentState === 'active') {
      void startBackgroundLocation();
    }
    const id = setInterval(() => {
      void publishGpsRuntimeStatus('heartbeat');
    }, 60_000);
    void publishGpsRuntimeStatus('tracking_active');
    return () => clearInterval(id);
  }, [status, trackingActive]);

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
