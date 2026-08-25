import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { clockIn, getTodayStatus } from '@/lib/api/attendance';
import { formatClock, formatLongDate } from '@/lib/format';
import { requestLocation } from '@/lib/location';

export default function ClockInScreen() {
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
      if (status?.is_clocked_in) {
        router.replace('/(app)/clock');
      }
    })();
  }, []);

  async function onClockIn() {
    setLoading(true);
    setError('');
    try {
      // GPS is required by the attendance API, but this screen is attendance-only.
      const loc = await requestLocation();
      const record = await clockIn(loc.latitude, loc.longitude);
      router.replace({
        pathname: '/clock-in-confirmed',
        params: {
          time: record.clock_in_time,
          address: record.clock_in_address ?? loc.address ?? '',
          accuracy: String(loc.accuracy ?? 3),
        },
      });
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
      if (code === 'services_off') {
        router.replace({ pathname: '/location-required', params: { reason: 'off', next: '/clock-in' } });
        return;
      }
      if (code === 'denied') {
        router.replace({ pathname: '/location-required', params: { reason: 'denied', next: '/clock-in' } });
        return;
      }
      const message = err instanceof Error ? err.message : 'Clock-in failed.';
      if (message.toLowerCase().includes('already clocked in')) {
        router.replace('/(app)/clock');
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Clock In" onBack={() => router.back()} />
      <View style={styles.sheet}>
        <View style={styles.card}>
          <Text style={styles.badge}>ATTENDANCE</Text>
          <Text style={styles.title}>Mark attendance</Text>
          <Text style={styles.copy}>
            Clock in only records your attendance. Live location starts separately with Start Tracking.
          </Text>
        </View>

        <Text style={styles.timeLabel}>Current Time</Text>
        <Text style={styles.time}>{formatClock(now.toISOString())}</Text>
        <Text style={styles.date}>{formatLongDate(now)}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Clock In" onPress={() => void onClockIn()} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  sheet: { padding: 20, gap: 10, flex: 1 },
  card: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    gap: 8,
    backgroundColor: Colors.surface,
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
  timeLabel: { textAlign: 'center', color: Colors.muted, marginTop: 24 },
  time: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.heading },
  date: { textAlign: 'center', color: Colors.muted, marginTop: -6, marginBottom: 12 },
  error: { color: Colors.danger, fontSize: 13 },
});
