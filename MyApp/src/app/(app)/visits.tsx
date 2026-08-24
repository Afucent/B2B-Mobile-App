import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
import { formatClock, formatDate } from '@/lib/format';
import { ymd } from '@/lib/leaveUi';

export default function VisitsScreen() {
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMyVisits(ymd(new Date())).catch(() => ({ items: [] as FieldVisit[] }));
    setVisits(res.items);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pending = visits.filter((v) => v.status === 'assigned' || v.status === 'in_progress');
  const done = visits.filter((v) => v.status === 'completed');

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visits" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>Assigned visits for {formatDate(new Date())}. Tap Visit to complete.</Text>

        <Text style={styles.sectionTitle}>Assigned</Text>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {!loading && pending.length === 0 ? (
          <Text style={styles.meta}>No visits assigned for today.</Text>
        ) : null}
        {pending.map((visit, index) => (
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
        ))}

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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  sub: { color: Colors.muted, lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading, marginTop: 8 },
  meta: { color: Colors.muted },
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
});
