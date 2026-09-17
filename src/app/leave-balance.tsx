import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import {
  getLeaveBalance,
  getMyLeaveRequests,
  type LeaveBalance,
  type LeaveRequest,
} from '@/lib/api/leave';
import { displayYmdRange, fiscalPeriod, leaveStatusMeta } from '@/lib/leaveUi';

export default function LeaveBalanceScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LeaveBalance[]>([]);
  const [takenLeaves, setTakenLeaves] = useState<LeaveRequest[]>([]);
  const fy = fiscalPeriod();

  useFocusEffect(
    useCallback(() => {
      void getLeaveBalance()
        .then((res) => setItems(res.items.filter((item) => item.is_active)))
        .catch(() => setItems([]));
      void getMyLeaveRequests()
        .then((rows) =>
          setTakenLeaves(
            rows.filter((r) => r.status === 'approved' || r.status === 'pending'),
          ),
        )
        .catch(() => setTakenLeaves([]));
    }, []),
  );

  const totalAvailable = items.reduce((sum, item) => sum + (item.balance || 0), 0);
  const totalTaken = items.reduce((sum, item) => {
    const used =
      item.used_days ??
      Math.max(0, (item.annual_days ?? item.balance) - item.balance);
    return sum + used;
  }, 0);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Leave Balance" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.fyRow}>
          <Text style={styles.fyLabel}>Current Fiscal Period</Text>
          <Text style={styles.fyValue}>{fy.label}</Text>
        </View>

        <Text style={styles.hero}>{totalAvailable}</Text>
        <Text style={styles.heroSub}>days available</Text>
        <Text style={styles.takenHero}>{totalTaken} days taken</Text>

        {items.map((item) => {
          const quota = item.annual_days ?? item.balance;
          const remaining = item.balance;
          const used = item.used_days ?? Math.max(0, (quota || 0) - remaining);
          const ratio = quota ? Math.min(1, used / quota) : remaining > 0 ? 1 : 0;
          return (
            <View key={item.leave_type_id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.name}>{item.leave_type_name}</Text>
                <Text style={styles.frac}>
                  {used}/{quota || 0}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <Text style={styles.remain}>{remaining} remaining</Text>
              <Text style={styles.taken}>{used} taken</Text>
            </View>
          );
        })}

        {items.length === 0 ? (
          <Text style={styles.empty}>Leave balances are not configured yet.</Text>
        ) : (
          <Text style={styles.reset}>Balance resets {fy.reset}</Text>
        )}

        <Text style={styles.sectionTitle}>Leaves taken</Text>
        {takenLeaves.length === 0 ? (
          <Text style={styles.empty}>No leaves taken yet.</Text>
        ) : (
          takenLeaves.map((leave) => {
            const meta = leaveStatusMeta(leave.status);
            return (
              <View key={leave.id} style={styles.leaveRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaveName}>{leave.leave_type_name || 'Leave'}</Text>
                  <Text style={styles.leaveDates}>
                    {displayYmdRange(leave.from_date, leave.to_date)} · {leave.number_of_days} day
                    {leave.number_of_days === 1 ? '' : 's'}
                  </Text>
                  {leave.reason ? <Text style={styles.leaveReason}>{leave.reason}</Text> : null}
                </View>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { paddingHorizontal: 16, gap: 8 },
  fyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  fyLabel: { color: Colors.muted },
  fyValue: { fontWeight: '800', color: Colors.heading },
  hero: {
    textAlign: 'center',
    fontSize: 56,
    fontWeight: '800',
    color: Colors.brand,
    marginTop: 12,
  },
  heroSub: { textAlign: 'center', color: Colors.muted, marginTop: -8 },
  takenHero: {
    textAlign: 'center',
    color: Colors.heading,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontWeight: '800', color: Colors.heading },
  frac: { color: Colors.muted, fontWeight: '700' },
  track: { height: 6, borderRadius: 99, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: Colors.brand, borderRadius: 99 },
  remain: { color: Colors.muted, fontSize: 13 },
  taken: { color: Colors.heading, fontSize: 13, fontWeight: '700', marginTop: -4 },
  empty: { textAlign: 'center', color: Colors.muted, marginVertical: 16 },
  reset: { textAlign: 'center', color: Colors.muted, marginVertical: 8 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.heading,
    marginTop: 12,
    marginBottom: 4,
  },
  leaveRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaveName: { fontWeight: '700', color: Colors.heading },
  leaveDates: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  leaveReason: { color: Colors.text, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
