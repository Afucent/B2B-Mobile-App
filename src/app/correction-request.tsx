import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { cancelCorrection, getCorrection, type CorrectionRequest } from '@/lib/corrections';
import { formatClock, formatDate } from '@/lib/format';

export default function CorrectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<CorrectionRequest | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void getCorrection(id).then(setItem);
    }, [id]),
  );

  if (!item) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Correction Request" onBack={() => router.back()} />
        <Text style={styles.empty}>Request not found.</Text>
      </View>
    );
  }

  const pending = item.status === 'pending';
  const approved = item.status === 'approved';
  const rejected = item.status === 'rejected';

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Correction Request" onBack={() => router.back()} />
      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.h1}>Request Details</Text>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.card}>
          <Text style={styles.section}>Shift log summary</Text>
          <Row label="Date" value={formatDate(new Date(`${item.date}T00:00:00`))} />
          <Row
            label={approved ? 'Actual Clock-In' : 'Requested Clock-In'}
            value={item.clockIn}
          />
          <Row
            label={approved ? 'Actual Clock-Out' : 'Requested Clock-Out'}
            value={item.clockOut}
          />
          {pending || rejected ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reason}>{item.reason}</Text>
            </>
          ) : null}
        </View>

        {pending ? (
          <View style={styles.wait}>
            <Text style={styles.waitText}>
              Awaiting approval from <Text style={styles.strong}>{item.managerName}</Text>
            </Text>
            <Text style={styles.meta}>Submitted: {formatDate(item.submittedAt)} · {formatClock(item.submittedAt)}</Text>
          </View>
        ) : null}

        {approved ? (
          <View style={styles.ok}>
            <Text style={styles.okTitle}>Approved by {item.managerName}</Text>
            <Text style={styles.okMeta}>
              Approved on: {formatDate(item.decidedAt)} · {formatClock(item.decidedAt)}
            </Text>
          </View>
        ) : null}

        {rejected ? (
          <View style={styles.bad}>
            <Text style={styles.badTitle}>Reason for Rejection:</Text>
            <Text style={styles.badBody}>{item.rejectionReason || 'Request was not approved.'}</Text>
            <Text style={styles.badMeta}>
              Rejected by {item.managerName} on {formatDate(item.decidedAt)} · {formatClock(item.decidedAt)}
            </Text>
          </View>
        ) : null}

        {approved ? (
          <Text style={styles.payroll}>Your attendance record has been updated and synced to payroll.</Text>
        ) : null}

        <View style={{ flex: 1 }} />

        {pending ? (
          <OutlineButton
            label="Cancel Request"
            onPress={() =>
              Alert.alert('Cancel request', 'Withdraw this correction request?', [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Cancel request',
                  style: 'destructive',
                  onPress: () => {
                    void cancelCorrection(item.id).then(() => router.back());
                  },
                },
              ])
            }
          />
        ) : null}

        {rejected ? (
          <PrimaryButton label="Submit New Request" onPress={() => router.replace('/request-correction')} />
        ) : null}

        {approved || rejected ? (
          <OutlineButton label="Back to Calendar" onPress={() => router.replace('/(app)/calendar')} />
        ) : null}
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: CorrectionRequest['status'] }) {
  const map = {
    pending: { label: 'PENDING', bg: Colors.pendingBg, color: Colors.pendingText },
    approved: { label: 'APPROVED', bg: Colors.successBg, color: Colors.successText },
    rejected: { label: 'REJECTED', bg: Colors.dangerBg, color: Colors.danger },
  } as const;
  const item = map[status];
  return (
    <View style={[styles.badge, { backgroundColor: item.bg }]}>
      <Text style={[styles.badgeText, { color: item.color }]}>{item.label}</Text>
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
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: 16, gap: 12, paddingBottom: 24 },
  empty: { padding: 24, color: Colors.muted },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: Colors.muted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: Colors.muted },
  rowValue: { fontWeight: '700', color: Colors.heading },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  reasonLabel: { color: Colors.muted },
  reason: { fontWeight: '700', color: Colors.heading },
  wait: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
  },
  waitText: { color: Colors.text },
  strong: { fontWeight: '800' },
  meta: { color: Colors.muted, marginTop: 6, fontSize: 12 },
  ok: { backgroundColor: Colors.successBg, borderRadius: Radius.lg, padding: 14 },
  okTitle: { color: Colors.successText, fontWeight: '800' },
  okMeta: { color: Colors.successText, marginTop: 4, fontSize: 12 },
  bad: { backgroundColor: Colors.dangerBg, borderRadius: Radius.lg, padding: 14 },
  badTitle: { color: Colors.danger, fontWeight: '800' },
  badBody: { color: Colors.danger, marginTop: 4 },
  badMeta: { color: Colors.danger, marginTop: 8, fontSize: 12 },
  payroll: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
});
