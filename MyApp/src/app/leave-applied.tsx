import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Stamp } from '@/components/ui/Stamp';
import { Colors, Radius } from '@/constants/theme';
import { formatClock, formatDate } from '@/lib/format';
import { displayYmdRange, leaveStatusMeta } from '@/lib/leaveUi';

export default function LeaveAppliedScreen() {
  const params = useLocalSearchParams<{
    type?: string;
    from?: string;
    to?: string;
    days?: string;
    status?: string;
    createdAt?: string;
  }>();
  const days = Number(params.days || 1);
  const status = leaveStatusMeta(params.status || 'pending');
  const stampDate = params.createdAt ? formatDate(params.createdAt) : formatDate(new Date());
  const stampTime = formatClock(params.createdAt || new Date().toISOString());

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Leave Applied" onBack={() => router.replace('/(app)/leaves')} />
      <View style={styles.body}>
        <Stamp
          title="LEAVE APPLIED"
          subtitle={`●  ${stampDate.toUpperCase()}  ·  ${stampTime}`}
        />
        <View style={styles.card}>
          <Row label="Leave Type:" value={params.type || 'Leave'} />
          <Row
            label="Dates:"
            value={params.from && params.to ? displayYmdRange(params.from, params.to) : '—'}
          />
          <Row label="Duration:" value={`${days} day${days === 1 ? '' : 's'}`} accent />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Status:</Text>
            <View style={[styles.pill, { backgroundColor: status.bg }]}>
              <Text style={[styles.pillText, { color: status.color }]}>
                {params.status === 'pending' ? 'Pending Approval' : status.label}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.note}>Your manager has been notified.</Text>
        <View style={{ flex: 1 }} />
        <PrimaryButton label="View Leave Status" onPress={() => router.replace('/(app)/leaves')} />
        <OutlineButton label="Back to Dashboard" onPress={() => router.replace('/(app)')} />
      </View>
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, accent && { color: Colors.brand }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, paddingBottom: 24, gap: 16 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  note: { textAlign: 'center', color: Colors.muted },
});
