import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FieldOpsSettingsSummary from '@/components/FieldOpsSettingsSummary';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useFieldOpsSettings } from '@/context/FieldOpsSettingsContext';
import { useTracking } from '@/context/TrackingContext';
import { CLOCK_RETURN, executeClockOutToComplete } from '@/lib/attendanceActions';
import { getTodayStatus, type AttendanceRecord } from '@/lib/api/attendance';
import { durationLabel, formatClock } from '@/lib/format';

export default function ClockOutScreen() {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useFieldOpsSettings();
  const { refreshStatus } = useTracking();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void (async () => {
      const status = await getTodayStatus().catch(() => null);
      setRecord(status?.record ?? null);
      if (!status?.is_clocked_in) {
        router.replace(CLOCK_RETURN);
      }
    })();
  }, []);

  async function onClockOut() {
    setLoading(true);
    setError('');
    try {
      const result = await executeClockOutToComplete({
        userId: user?.id,
        returnTo: CLOCK_RETURN,
      });

      if (!result.ok) {
        if (result.error.kind === 'navigate') {
          router.replace(result.error.href);
          return;
        }
        setError(result.error.kind === 'message' ? result.error.message : 'Clock-out failed.');
        return;
      }

      await refreshStatus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.flex, { paddingBottom: insets.bottom + 20 }]}>
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

        <FieldOpsSettingsSummary
          settings={settings}
          loading={settingsLoading}
          title="Shift rules for clock-out"
          compact
        />

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
  sheet: { flex: 1, padding: 20, gap: 10 },
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
  summaryTitle: { marginTop: 8, fontWeight: '700', color: Colors.heading },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  accent: { color: Colors.brand },
  error: { color: Colors.danger, fontSize: 13 },
});
