import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Stamp } from '@/components/ui/Stamp';
import { Colors, Radius } from '@/constants/theme';
import { formatClock, formatDate, hoursToLabel } from '@/lib/format';

function paramValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function hoursFromRange(inTime?: string, outTime?: string) {
  if (!inTime || !outTime) return 0;
  const ms = new Date(outTime).getTime() - new Date(inTime).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return ms / 3_600_000;
}

export default function ShiftCompleteScreen() {
  const insets = useSafeAreaInsets();
  const raw = useLocalSearchParams<{
    inTime?: string | string[];
    outTime?: string | string[];
    hours?: string | string[];
    distance?: string | string[];
    visitsDone?: string | string[];
    visitsAssigned?: string | string[];
    lock?: string | string[];
  }>();

  const inTime = paramValue(raw.inTime);
  const outTime = paramValue(raw.outTime);
  const hoursParam = paramValue(raw.hours);
  const distanceParam = paramValue(raw.distance);
  const visitsDone = paramValue(raw.visitsDone);
  const visitsAssigned = paramValue(raw.visitsAssigned);
  const lock = paramValue(raw.lock);

  const parsedHours = hoursParam != null && hoursParam !== '' ? Number(hoursParam) : NaN;
  const hoursValue = Number.isFinite(parsedHours) ? parsedHours : hoursFromRange(inTime, outTime);
  const hours = hoursToLabel(hoursValue);
  const done = Number(visitsDone ?? 0) || 0;
  const assigned = Number(visitsAssigned ?? 0) || Math.max(done, 1);
  const progress = assigned > 0 ? Math.round((done / assigned) * 100) : 0;
  const out = outTime ?? new Date().toISOString();
  const distance = Number(distanceParam ?? 0) || 0;

  return (
    <View style={styles.screen}>
      <Text style={styles.nav}>Shift Completed</Text>
      <View style={styles.body}>
        <Stamp title="SHIFT COMPLETE" subtitle={`●  ${formatDate(out).toUpperCase()}  ·  ${formatClock(out)}`} />
        <Text style={styles.caption}>Total Working Hours</Text>
        <Text style={styles.hours}>{hours}</Text>

        <View style={styles.card}>
          <Row label="Total Distance:" value={`${distance.toFixed(1)} km`} />
          <Row label="Visits completed:" value={`${done} of ${assigned} dealers`} />
          <Text style={styles.progressLabel}>Route completion progress</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={styles.progressPct}>{progress}%</Text>
        </View>

        <Text style={styles.meta}>
          Clocked in: {formatClock(inTime)} · Clocked out: {formatClock(out)}
        </Text>
        <Text style={styles.lock}>Digital signature lock reference: #{lock ?? 'A1B2C3'}</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <PrimaryButton label="Back to Dashboard" onPress={() => router.replace('/(app)')} />
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  nav: { textAlign: 'center', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 8 },
  caption: { textAlign: 'center', color: Colors.muted, marginTop: 28 },
  hours: { textAlign: 'center', fontSize: 40, fontWeight: '800', color: Colors.heading },
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700' },
  progressLabel: { color: Colors.muted, fontSize: 13 },
  track: { height: 8, backgroundColor: Colors.brandSoft, borderRadius: 99, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.brand },
  progressPct: { textAlign: 'right', color: Colors.muted, fontSize: 12 },
  meta: { textAlign: 'center', color: Colors.muted, marginTop: 16, fontSize: 13 },
  lock: { textAlign: 'center', color: Colors.muted, fontSize: 12 },
  footer: { padding: 24 },
});
