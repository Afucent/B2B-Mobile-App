import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/theme';
import { getMyLeaveRequests, type LeaveRequest } from '@/lib/api/leave';
import { displayYmdRange, leaveStatusMeta } from '@/lib/leaveUi';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

export default function LeavesScreen() {
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void getMyLeaveRequests()
        .then(setRequests)
        .catch(() => setRequests([]));
    }, []),
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return requests;
    return requests.filter((item) => item.status.toLowerCase() === filter);
  }, [requests, filter]);

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>My Leaves</Text>
        <Link href="/leave-balance" asChild>
          <Pressable hitSlop={12} style={styles.balanceHit}>
            <Text style={styles.balanceLink}>Balance</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.filters}>
        {(
          [
            ['all', 'All'],
            ['pending', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === key && styles.chipOnText]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {requests.length > 0 ? (
          <Text style={styles.count}>
            {filtered.length} request{filtered.length === 1 ? '' : 's'}
          </Text>
        ) : null}

        {filtered.length === 0 && requests.length > 0 ? (
          <Text style={styles.emptyCopy}>No {filter} requests.</Text>
        ) : null}

        {requests.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="calendar-outline" size={36} color={Colors.tabInactive} />
            </View>
            <Text style={styles.emptyTitle}>No leave requests yet</Text>
            <Text style={styles.emptyCopy}>Your submitted requests will appear here.</Text>
            <Pressable onPress={() => router.push('/apply-leave')}>
              <Text style={styles.applyLink}>+ Apply Leave</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map((item) => {
            const status = leaveStatusMeta(item.status);
            return (
              <View key={item.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.leave_type_name}</Text>
                  <Text style={styles.dates}>{displayYmdRange(item.from_date, item.to_date)}</Text>
                </View>
                <Text style={styles.days}>{item.number_of_days}d</Text>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {requests.length > 0 ? (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 88 }]}
          onPress={() => router.push('/apply-leave')}>
          <Text style={styles.fabText}>+ Apply Leave</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  balanceHit: { paddingVertical: 6, paddingHorizontal: 4 },
  balanceLink: { color: Colors.brand, fontWeight: '700' },
  filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brand },
  chipText: { fontSize: 13, fontWeight: '700', color: Colors.muted },
  chipOnText: { color: '#fff' },
  list: { padding: 16, paddingBottom: 140, gap: 8 },
  count: { color: Colors.muted, marginBottom: 4 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: { fontWeight: '800', color: Colors.heading },
  dates: { color: Colors.muted, marginTop: 2, fontSize: 13 },
  days: { color: Colors.muted, fontWeight: '700' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 72, gap: 8 },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  emptyCopy: { color: Colors.muted, textAlign: 'center' },
  applyLink: { color: Colors.brand, fontWeight: '800', marginTop: 8, fontSize: 16 },
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.brand,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#fff', fontWeight: '800' },
});
