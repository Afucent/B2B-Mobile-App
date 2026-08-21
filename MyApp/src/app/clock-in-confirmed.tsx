import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Stamp } from '@/components/ui/Stamp';
import { Colors } from '@/constants/theme';
import { formatClock, formatDate } from '@/lib/format';

export default function ClockInConfirmedScreen() {
  const params = useLocalSearchParams<{ time?: string; address?: string; accuracy?: string }>();
  const time = params.time ? formatClock(params.time) : formatClock(new Date().toISOString());
  const date = params.time ? formatDate(params.time) : formatDate(new Date());
  const accuracy = params.accuracy ? Math.round(Number(params.accuracy) || 3) : 3;

  return (
    <View style={styles.screen}>
      <Text style={styles.nav}>Confirmation</Text>
      <View style={styles.body}>
        <Stamp title="CLOCK-IN VERIFIED" subtitle={`●  ${date.toUpperCase()}  ·  ${time}`} />
        <Text style={styles.caption}>Record Timestamp</Text>
        <Text style={styles.time}>{time}</Text>

        <View style={styles.rows}>
          <Row label="Registered Checkpoint:" value={params.address || 'Current location'} />
          <Row label="Device GPS Lock:" value={`SECURE  (±${accuracy}m)`} valueColor={Colors.success} />
          <Row label="Shift status:" value="Shift Started · Tracking" valueColor={Colors.brand} />
        </View>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="Back to Dashboard" onPress={() => router.replace('/(app)')} />
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background, paddingTop: 56 },
  nav: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.heading },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 48, gap: 12 },
  caption: { textAlign: 'center', color: Colors.muted, marginTop: 28 },
  time: { textAlign: 'center', fontSize: 42, fontWeight: '800', color: Colors.heading },
  rows: { marginTop: 28, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: Colors.muted, flex: 1 },
  rowValue: { color: Colors.heading, fontWeight: '700', flex: 1, textAlign: 'right' },
  footer: { padding: 24 },
});
