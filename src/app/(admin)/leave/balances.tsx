import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  listOrgLeaveBalances,
  type OrgLeaveBalanceRow,
} from '@/lib/api/leaveAdmin';

type EmployeeGroup = {
  employee_id: string;
  employee_name: string;
  rows: OrgLeaveBalanceRow[];
  total: number;
};

export default function AdminLeaveBalancesScreen() {
  return (
    <RequireModuleAccess modules={['leave_requests', 'users', 'leave_types']}>
      <BalancesContent />
    </RequireModuleAccess>
  );
}

function BalancesContent() {
  const [items, setItems] = useState<OrgLeaveBalanceRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listOrgLeaveBalances();
      setItems(res.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leave balances');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const groups = useMemo<EmployeeGroup[]>(() => {
    const map = new Map<string, EmployeeGroup>();
    for (const row of items) {
      const existing = map.get(row.employee_id);
      if (existing) {
        existing.rows.push(row);
        existing.total += row.balance || 0;
      } else {
        map.set(row.employee_id, {
          employee_id: row.employee_id,
          employee_name: row.employee_name,
          rows: [row],
          total: row.balance || 0,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }, [items]);

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Leave balance" onBack={() => router.back()} />
      <FlatList
        data={groups}
        keyExtractor={(item) => item.employee_id}
        contentContainerStyle={styles.body}
        ListHeaderComponent={
          <>
            {loading ? <Text style={styles.meta}>Loading…</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error ? (
              <Text style={styles.meta}>{groups.length} employees</Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.meta}>No leave balances found.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name}>{item.employee_name}</Text>
              <Text style={styles.total}>{item.total}d</Text>
            </View>
            {item.rows.map((row) => (
              <View key={`${row.employee_id}-${row.leave_type_id}`} style={styles.row}>
                <Text style={styles.type}>{row.leave_type_name}</Text>
                <Text style={styles.days}>
                  {row.balance} left
                  {row.used_days ? ` · ${row.used_days} used` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.xl },
  meta: { color: Colors.muted, marginBottom: Spacing.sm },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 15, flex: 1 },
  total: { fontWeight: '800', color: Colors.brand },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { color: Colors.text, fontWeight: '600', flex: 1 },
  days: { color: Colors.muted, fontSize: 13 },
});
