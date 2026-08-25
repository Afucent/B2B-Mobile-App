import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { clockOut, getTodayStatus, type AttendanceRecord } from '@/lib/api/attendance';
import { durationLabel, formatClock } from '@/lib/format';
import { requestLocation } from '@/lib/location';

export default function ClockOutScreen() {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      const status = await getTodayStatus().catch(() => null);
      setRecord(status?.record ?? null);
      if (!status?.is_clocked_in) {
        router.replace('/(app)/clock');
      }
    })();
  }, []);

  async function onClockOut() {
    setLoading(true);
    setError('');
    try {
      const loc = await requestLocation();
      const closed = await clockOut(loc.latitude, loc.longitude);
      router.replace({
        pathname: '/shift-complete',
        params: {
          inTime: closed.clock_in_time,
          outTime: closed.clock_out_time ?? new Date().toISOString(),
          hours: String(closed.working_hours ?? ''),
          distance: '0',
          visitsDone: '0',
          visitsAssigned: '0',
          lock: closed.id.slice(0, 6).toUpperCase(),
        },
      });
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'services_off') {
        router.replace({ pathname: '/location-required', params: { reason: 'off', next: '/clock-out' } });
        return;
      }
      if (code === 'denied') {
        router.replace({
          pathname: '/location-required',
          params: { reason: 'denied', next: '/clock-out' },
        });
        return;
      }
      setError(err instanceof Error ? err.message : 'Clock-out failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Clock Out" onBack={() => router.back()} />
      <View style={styles.sheet}>
        <View style={styles.card}>
          <Text style={styles.badge}>ATTENDANCE</Text>
          <Text style={styles.title}>Close attendance</Text>
          <Text style={styles.copy}>
            Clock out ends your attendance session. Live tracking, if active, also stops here.
          </Text>
        </View>

        <Text style={styles.summaryTitle}>Today’s attendance</Text>
        <Row label="Started:" value={formatClock(record?.clock_in_time)} />
        <Row label="Current Time:" value={formatClock(now.toISOString())} />
        <Row label="Duration so far:" value={durationLabel(record?.clock_in_time, now)} accent />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Clock Out" onPress={() => void onClockOut()} loading={loading} />
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
  sheet: { padding: 20, gap: 8, flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    gap: 8,
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    color: Colors.brand,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  copy: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  summaryTitle: { marginTop: 8, fontWeight: '800', color: Colors.heading },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  accent: { color: Colors.brand },
  error: { color: Colors.danger },
});
