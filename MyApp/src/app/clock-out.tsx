import LocationMap from '@/components/LocationMap';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  clockOut,
  getEmployeeLiveDetail,
  getTodayStatus,
  type AttendanceRecord,
  type EmployeeLiveDetail,
} from '@/lib/api/attendance';
import { durationLabel, formatClock, formatKm } from '@/lib/format';
import { requestLocation, type DeviceLocation } from '@/lib/location';

export default function ClockOutScreen() {
  const { user } = useAuth();
  const [loc, setLoc] = useState<DeviceLocation | null>(null);
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [live, setLive] = useState<EmployeeLiveDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoc(await requestLocation());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to read GPS.');
      }
      const status = await getTodayStatus().catch(() => null);
      setRecord(status?.record ?? null);
      if (user) {
        setLive(await getEmployeeLiveDetail(user.id).catch(() => null));
      }
    })();
  }, [user]);

  async function onClockOut() {
    if (!loc) return;
    setLoading(true);
    setError('');
    try {
      const closed = await clockOut(loc.latitude, loc.longitude);
      router.replace({
        pathname: '/shift-complete',
        params: {
          inTime: closed.clock_in_time,
          outTime: closed.clock_out_time ?? new Date().toISOString(),
          hours: String(closed.working_hours ?? ''),
          distance: String(live?.distance_today_km ?? 0),
          visitsDone: String(live?.visits_completed ?? 0),
          visitsAssigned: String(live?.visits_assigned ?? 0),
          lock: closed.id.slice(0, 6).toUpperCase(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock-out failed.');
    } finally {
      setLoading(false);
    }
  }

  const lat = loc?.latitude ?? live?.latitude ?? 28.5355;
  const lon = loc?.longitude ?? live?.longitude ?? 77.391;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Clock Out" onBack={() => router.back()} />
      <View style={styles.hero}>
        {loc || live?.latitude ? (
          <LocationMap latitude={lat} longitude={lon} height={240} />
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </View>
      <View style={styles.sheet}>
        <Text style={styles.posLabel}>Current Position</Text>
        <Text style={styles.posValue}>
          {loc?.address || live?.address || 'Current GPS position'}
        </Text>

        <Text style={styles.summaryTitle}>Today’s shift summary</Text>
        <Row label="Started:" value={formatClock(record?.clock_in_time)} />
        <Row label="Current Time:" value={formatClock(now.toISOString())} />
        <Row
          label="Duration so far:"
          value={live?.working_duration_label ?? durationLabel(record?.clock_in_time, now)}
          accent
        />
        <Row label="Distance travelled:" value={formatKm(live?.distance_today_km)} accent />

        <Text style={styles.note}>
          Ensure all dealer visit status logs are synchronized before completing clock-out.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Clock Out" onPress={() => void onClockOut()} loading={loading} disabled={!loc} />
      </View>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, accent && styles.accent]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  hero: {
    backgroundColor: Colors.mapOverlay,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: 140,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#111',
  },
  phoneMap: { width: '100%', height: '100%' },
  sheet: { padding: 20, gap: 8, flex: 1 },
  posLabel: { color: Colors.muted, fontSize: 13 },
  posValue: { fontSize: 18, fontWeight: '800', color: Colors.heading, marginTop: -4 },
  summaryTitle: { marginTop: 12, fontWeight: '800', color: Colors.heading },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  accent: { color: Colors.brand },
  note: { color: Colors.muted, fontSize: 13, lineHeight: 18, marginVertical: 8 },
  error: { color: Colors.danger },
});
