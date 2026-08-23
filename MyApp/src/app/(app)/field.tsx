import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import TabModuleLinks from '@/components/TabModuleLinks';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
import { formatClock, formatDate } from '@/lib/format';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { buildFieldTabSections } from '@/lib/tabNavigation';
import { ymd } from '@/lib/leaveUi';

export default function FieldScreen() {
  return (
    <RequireEmployeeTab tab="field">
      <FieldContent />
    </RequireEmployeeTab>
  );
}

function FieldContent() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { canView, canCreate, canManage } = usePermissions();
  const [visits, setVisits] = useState<FieldVisit[]>([]);

  const fieldSections = buildFieldTabSections({
    canView,
    canCreate,
    canManage,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  });

  const load = useCallback(async () => {
    const res = await getMyVisits(ymd(new Date())).catch(() => ({ items: [] as FieldVisit[] }));
    setVisits(res.items);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pending = visits.filter((v) => v.status === 'assigned');
  const done = visits.filter((v) => v.status === 'completed');

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 120 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Field & Visits</Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>

        <Text style={styles.sectionTitle}>Today&apos;s visits</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>No visits assigned for today.</Text>
        ) : (
          pending.map((visit, index) => (
            <Pressable
              key={visit.id}
              style={styles.row}
              onPress={() =>
                router.push({ pathname: '/visit-complete', params: { visitId: visit.id } })
              }>
              <Text style={styles.index}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{visit.dealer_name ?? 'Dealer'}</Text>
                <Text style={styles.addr} numberOfLines={1}>
                  {visit.dealer_address ?? '—'} · {formatClock(visit.scheduled_at)}
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>Visit</Text>
              </View>
            </Pressable>
          ))
        )}

        {done.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Completed today</Text>
            {done.map((visit) => (
              <View key={visit.id} style={[styles.row, styles.doneRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{visit.dealer_name}</Text>
                  <Text style={styles.addr}>Completed {formatClock(visit.completed_at)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Pressable style={styles.quickCard} onPress={() => router.push('/unplanned-visit')}>
          <Ionicons name="add-circle-outline" size={22} color={Colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.quickTitle}>Unplanned visit</Text>
            <Text style={styles.quickCopy}>Search dealer, add reason, photo & notes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>

        <TabModuleLinks sections={fieldSections} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  header: { marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  date: { color: Colors.muted, marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading, marginTop: 8 },
  empty: { color: Colors.muted, marginTop: 4 },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneRow: { opacity: 0.85 },
  index: { width: 18, color: Colors.brand, fontWeight: '800' },
  name: { fontWeight: '700', color: Colors.heading },
  addr: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  pill: { backgroundColor: Colors.brandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: Colors.brand, fontWeight: '800', fontSize: 11 },
  quickCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickTitle: { fontWeight: '800', color: Colors.heading },
  quickCopy: { color: Colors.muted, fontSize: 12, marginTop: 2 },
});
