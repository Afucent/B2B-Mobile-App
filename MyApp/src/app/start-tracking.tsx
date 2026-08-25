import LocationMap from '@/components/LocationMap';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  endLocation,
  getEmployeeLiveDetail,
  getTodayStatus,
  pingLocation,
  startLocation,
  type EmployeeLiveDetail,
  type TodayStatus,
} from '@/lib/api/attendance';
import { getFieldOperationsSettings } from '@/lib/api/org';
import { durationLabel, formatClock, formatKm } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

export default function StartTrackingScreen() {
  const { user } = useAuth();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [live, setLive] = useState<EmployeeLiveDetail | null>(null);
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [pingMinutes, setPingMinutes] = useState(20);

  const refresh = useCallback(async () => {
    if (!user) return;
    const status = await getTodayStatus().catch(() => null);
    setToday(status);
    if (!status?.is_clocked_in) {
      setError('Clock in first, then start live tracking.');
      setLoading(false);
      return;
    }
    const liveDetail = await getEmployeeLiveDetail(user.id).catch(() => null);
    setLive(liveDetail);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void getFieldOperationsSettings()
      .then((settings) => setPingMinutes(Math.max(settings.gps_ping_interval_minutes ?? 20, 20)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoc(await requestLocation());
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'services_off') {
          router.replace({
            pathname: '/location-required',
            params: { reason: 'off', next: '/start-tracking' },
          });
          return;
        }
        if (code === 'denied') {
          router.replace({
            pathname: '/location-required',
            params: { reason: 'denied', next: '/start-tracking' },
          });
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to read GPS.');
      }
    })();
  }, []);

  useEffect(() => {
    if (!today?.tracking_active) return;
    let cancelled = false;
    async function ping() {
      try {
        const next = await requestLocation();
        if (cancelled) return;
        setLoc(next);
        await pingLocation(next.latitude, next.longitude, next.accuracy ?? undefined);
        await refresh();
      } catch {
        /* ignore transient GPS/API errors */
      }
    }
    void ping();
    const timer = setInterval(() => void ping(), pingMinutes * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pingMinutes, refresh, today?.tracking_active]);

  async function onStartTracking() {
    setBusy(true);
    setError('');
    try {
      const next = loc ?? (await requestLocation());
      setLoc(next);
      await startLocation(next.latitude, next.longitude);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start tracking.');
    } finally {
      setBusy(false);
    }
  }

  async function onEndTracking() {
    setBusy(true);
    setError('');
    try {
      const next = loc ?? (await requestLocation());
      setLoc(next);
      await endLocation(next.latitude, next.longitude);
      router.replace('/(app)/clock');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end tracking.');
    } finally {
      setBusy(false);
    }
  }

  const trackingActive = Boolean(today?.tracking_active);
  const record = today?.record;
  const lat = loc?.latitude ?? live?.latitude ?? null;
  const lon = loc?.longitude ?? live?.longitude ?? null;
  const mapLabel = live?.employee_name ?? user?.name ?? 'You';
  const mapInitials =
    live?.employee_initials ??
    (mapLabel
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p, i, arr) => (arr.length === 1 ? p.slice(0, 2) : p[0]))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'YO');
  const avatarUrl = live?.avatar_url ?? user?.avatar_url ?? null;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Live Tracking" onBack={() => router.back()} />

      <View style={styles.mapWrap}>
        {lat != null && lon != null ? (
          <LocationMap
            latitude={lat}
            longitude={lon}
            height={240}
            markers={[
              {
                id: user?.id ?? 'self',
                latitude: lat,
                longitude: lon,
                label: mapLabel,
                initials: mapInitials,
                avatarUrl,
                color: '#0F766E',
              },
            ]}
          />
        ) : (
          <View style={styles.mapFallback}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
        <View style={[styles.gpsBadge, trackingActive ? styles.gpsOn : styles.gpsOff]}>
          <Text style={styles.gpsText}>
            {trackingActive ? 'TRACKING ACTIVE · GPS ONLINE' : 'TRACKING OFF'}
          </Text>
        </View>
      </View>

      <View style={styles.sheet}>
        {loading ? <Text style={styles.meta}>Loading live tracking…</Text> : null}

        <Text style={styles.posLabel}>Current position</Text>
        <Text style={styles.posValue}>
          {loc?.address || live?.address || 'Waiting for live GPS…'}
        </Text>

        <View style={styles.metricSplit}>
          <View>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>
              {trackingActive
                ? live?.working_duration_label ?? durationLabel(record?.clock_in_time, now)
                : '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>
              {trackingActive ? formatKm(live?.distance_today_km) : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metricLabel}>Clocked in since</Text>
          <Text style={styles.metaValue}>{formatClock(record?.clock_in_time)}</Text>
          {trackingActive && live?.last_ping_label ? (
            <Text style={styles.meta}>Last ping · {live.last_ping_label}</Text>
          ) : null}
          <Text style={styles.meta}>Location logs every {pingMinutes} min while tracking</Text>
        </View>

        <Text style={styles.note}>
          Live location is fetched only after you start tracking. End tracking stops location updates
          without clocking out.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {trackingActive ? (
          <PrimaryButton label="End Tracking" onPress={() => void onEndTracking()} loading={busy} />
        ) : (
          <PrimaryButton
            label="Start Tracking"
            onPress={() => void onStartTracking()}
            loading={busy}
            disabled={!today?.is_clocked_in}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  mapWrap: { height: 240, backgroundColor: Colors.mapOverlay },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gpsBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gpsOn: { backgroundColor: 'rgba(4,120,87,0.9)' },
  gpsOff: { backgroundColor: 'rgba(20,20,20,0.72)' },
  gpsText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  sheet: { padding: 20, gap: 10, flex: 1 },
  posLabel: { color: Colors.muted, fontSize: 13 },
  posValue: { fontSize: 18, fontWeight: '800', color: Colors.heading, marginTop: -4 },
  metricSplit: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metricLabel: { color: Colors.muted, fontSize: 12 },
  metricValue: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  metaCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    gap: 4,
  },
  metaValue: { color: Colors.heading, fontWeight: '700', fontSize: 16 },
  note: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: Colors.muted, fontSize: 12 },
  error: { color: Colors.danger, fontSize: 13 },
});
