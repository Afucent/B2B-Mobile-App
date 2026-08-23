import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyVisitHistory, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { formatClock } from '@/lib/format';
import { displayYmdRange, ymd } from '@/lib/leaveUi';

export default function VisitHistoryScreen() {
  const { canView } = usePermissions();
  const isAdmin = canView('visit_history');
  return isAdmin ? (
    <RequireModuleAccess module="visit_history">
      <VisitHistoryContent admin />
    </RequireModuleAccess>
  ) : (
    <VisitHistoryContent admin={false} />
  );
}

function VisitHistoryContent({ admin }: { admin: boolean }) {
  const [items, setItems] = useState<FieldVisit[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [employeeId, setEmployeeId] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (admin) {
        void listUsers(0, 100)
          .then((res) => setEmployees(res.items))
          .catch(() => setEmployees([]));
      }
    }, [admin]),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = admin
        ? await getVisitHistory({
            employee_id: employeeId === 'all' ? undefined : employeeId,
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
            status: 'completed',
          })
        : await getMyVisitHistory({
            from_date: fromDate || undefined,
            to_date: toDate || undefined,
          });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [admin, employeeId, fromDate, toDate]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit history" onBack={() => router.back()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.filters}>
            <Text style={styles.sub}>
              {admin ? 'Employee visit history across the organisation.' : 'Your completed dealer visits.'}
            </Text>
            {admin ? (
              <ScrollChips
                label="Employee"
                value={employeeId}
                onChange={setEmployeeId}
                options={[{ id: 'all', name: 'All' }, ...employees.map((e) => ({ id: e.id, name: e.name }))]}
              />
            ) : null}
            <View style={styles.dateRow}>
              <Pressable style={styles.dateChip} onPress={() => setFromDate(ymd(new Date(Date.now() - 7 * 86400000)))}>
                <Text style={styles.dateChipText}>Last 7 days</Text>
              </Pressable>
              <Pressable
                style={styles.dateChip}
                onPress={() => setFromDate(ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))}>
                <Text style={styles.dateChipText}>This month</Text>
              </Pressable>
              <Pressable
                style={styles.dateChip}
                onPress={() => {
                  setFromDate('');
                  setToDate('');
                }}>
                <Text style={styles.dateChipText}>All</Text>
              </Pressable>
            </View>
            {loading ? <Text style={styles.meta}>Loading…</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.meta}>No visits found.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.dealer_name ?? 'Dealer'}</Text>
                {admin ? <Text style={styles.emp}>{item.employee_name}</Text> : null}
                <Text style={styles.subRow}>
                  {displayYmdRange(
                    item.scheduled_at.slice(0, 10),
                    item.completed_at?.slice(0, 10) ?? item.scheduled_at.slice(0, 10),
                  )}
                  {item.completed_at ? ` · ${formatClock(item.completed_at)}` : ''}
                </Text>
                {item.unplanned ? <Text style={styles.tag}>Unplanned · {item.unplanned_reason}</Text> : null}
              </View>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={styles.thumbEmpty}>
                  <Text style={styles.thumbEmptyText}>No image</Text>
                </View>
              )}
            </View>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notes}>{item.notes?.trim() ? item.notes : '—'}</Text>
          </View>
        )}
      />
    </View>
  );
}

function ScrollChips({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.filterLabel}>{label}</Text>
      <FlatList
        horizontal
        data={options}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.chip, value === item.id && styles.chipActive]}
            onPress={() => onChange(item.id)}>
            <Text style={[styles.chipText, value === item.id && styles.chipTextActive]}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  filters: { gap: Spacing.sm, marginBottom: Spacing.sm },
  sub: { color: Colors.muted, lineHeight: 20 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  dateChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateChipText: { fontSize: 12, fontWeight: '600', color: Colors.heading },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: '#fff' },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
    marginBottom: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  rowTop: { flexDirection: 'row', gap: 12 },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  emp: { color: Colors.brand, fontWeight: '700' },
  subRow: { color: Colors.muted, fontSize: 12 },
  tag: { color: Colors.pendingText, fontSize: 11, fontWeight: '700' },
  notesLabel: { marginTop: 4, fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  notes: { color: Colors.text, fontSize: 13 },
  thumb: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.borderLight },
  thumbEmpty: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmptyText: { fontSize: 10, color: Colors.muted, textAlign: 'center' },
});
