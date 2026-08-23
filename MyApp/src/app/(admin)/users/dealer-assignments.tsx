import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { listDealerAssignments, type DealerAssignmentRow } from '@/lib/api/users';

export default function DealerAssignmentsScreen() {
  const [rows, setRows] = useState<DealerAssignmentRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedDealerId, setSelectedDealerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setRows(await listDealerAssignments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDealer = useMemo(() => {
    const map = new Map<
      string,
      { dealer: DealerAssignmentRow; assignees: DealerAssignmentRow[] }
    >();
    for (const row of rows) {
      const existing = map.get(row.dealer_id);
      if (existing) {
        existing.assignees.push(row);
      } else {
        map.set(row.dealer_id, { dealer: row, assignees: [row] });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const selected = selectedDealerId
    ? byDealer.find((g) => g.dealer.dealer_id === selectedDealerId)
    : null;

  return (
    <RequireModuleAccess module="dealers">
      <View style={styles.flex}>
        <ScreenHeader title="Dealer assignment" onBack={() => router.back()} />
        <View style={styles.body}>
          <Text style={styles.hint}>
            Tap a dealer to see assigned field users. Assign dealers from Create user or a user
            profile.
          </Text>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={byDealer}
            keyExtractor={(item) => item.dealer.dealer_id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: Spacing.xl }}
            ListEmptyComponent={
              !loading ? <Text style={styles.meta}>No dealers assigned yet.</Text> : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.row,
                  selectedDealerId === item.dealer.dealer_id && styles.rowSelected,
                ]}
                onPress={() => setSelectedDealerId(item.dealer.dealer_id)}>
                <Text style={styles.name}>{item.dealer.dealer_name}</Text>
                <Text style={styles.sub}>
                  {[item.dealer.area, item.dealer.city, item.dealer.state]
                    .filter(Boolean)
                    .join(' · ') || 'No location'}
                </Text>
                <Text style={styles.sub}>
                  Assigned to {item.assignees.length} user
                  {item.assignees.length === 1 ? '' : 's'}
                </Text>
              </Pressable>
            )}
          />

          {selected ? (
            <View style={styles.detail}>
              <Text style={styles.detailTitle}>{selected.dealer.dealer_name}</Text>
              <Text style={styles.sub}>
                {selected.dealer.dealer_email}
                {selected.dealer.dealer_mobile ? ` · ${selected.dealer.dealer_mobile}` : ''}
              </Text>
              <Text style={styles.sectionLabel}>Assigned to users</Text>
              {selected.assignees.map((row) => (
                <Pressable
                  key={`${row.user_id}-${row.dealer_id}`}
                  style={styles.assignee}
                  onPress={() => router.push(`/(admin)/users/${row.user_id}`)}>
                  <Text style={styles.name}>{row.user_name}</Text>
                  <Text style={styles.sub}>{row.user_email}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  hint: { color: Colors.muted, fontSize: 13, marginBottom: Spacing.sm },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowSelected: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  name: { fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  detail: {
    marginTop: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  detailTitle: { fontWeight: '700', color: Colors.heading, fontSize: 16 },
  sectionLabel: {
    marginTop: Spacing.sm,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  assignee: {
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
