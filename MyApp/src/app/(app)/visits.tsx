import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { DateField } from '@/components/ui/DateField';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
import { formatClock, formatDate } from '@/lib/format';
import { parseYmd, ymd } from '@/lib/leaveUi';

function shiftDay(day: string, delta: number) {
  const d = parseYmd(day);
  d.setDate(d.getDate() + delta);
  return ymd(d);
}

export default function VisitsScreen() {
  const [day, setDay] = useState(() => ymd(new Date()));
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMyVisits(day).catch(() => ({ items: [] as FieldVisit[] }));
    setVisits(res.items);
    setLoading(false);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pending = visits.filter((v) => v.status === 'assigned' || v.status === 'in_progress');
  const isToday = day === ymd(new Date());

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visits" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>
          Select a date to see that day's visits. Pending visits show here — completed ones are
          in Visit history.
        </Text>

        <View style={styles.dateBar}>
          <Pressable
            style={styles.dayBtn}
            onPress={() => setDay((prev) => shiftDay(prev, -1))}
            accessibilityLabel="Previous day">
            <Ionicons name="chevron-back" size={20} color={Colors.heading} />
          </Pressable>
          <View style={styles.dateFieldWrap}>
            <DateField label="Visit date" value={day} onChange={setDay} />
          </View>
          <Pressable
            style={styles.dayBtn}
            onPress={() => setDay((prev) => shiftDay(prev, 1))}
            accessibilityLabel="Next day">
            <Ionicons name="chevron-forward" size={20} color={Colors.heading} />
          </Pressable>
        </View>

        {!isToday ? (
          <Pressable style={styles.todayChip} onPress={() => setDay(ymd(new Date()))}>
            <Text style={styles.todayChipText}>Jump to today</Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Pending</Text>
          <Pressable onPress={() => router.push('/visit-history')}>
            <Text style={styles.historyLink}>Visit history</Text>
          </Pressable>
        </View>

        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {!loading && pending.length === 0 ? (
          <Text style={styles.meta}>No pending visits for {formatDate(parseYmd(day))}.</Text>
        ) : null}

        {pending.map((visit, index) => (
          <Pressable
            key={visit.id}
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/visit-complete',
                params: {
                  visitId: visit.id,
                  dealerName: visit.dealer_name ?? 'Dealer',
                  dealerAddress: visit.dealer_address ?? '',
                  scheduledAt: visit.scheduled_at,
                },
              })
            }>
            <Text style={styles.index}>{index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{visit.dealer_name ?? 'Dealer'}</Text>
              <Text style={styles.addr} numberOfLines={1}>
                {visit.dealer_address ?? '—'} · {formatClock(visit.scheduled_at)}
              </Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Check-in</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  sub: { color: Colors.muted, lineHeight: 20 },
  dateBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  dateFieldWrap: { flex: 1 },
  dayBtn: {
    width: 44,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  todayChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayChipText: { color: Colors.brand, fontWeight: '700', fontSize: 12 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  historyLink: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
  meta: { color: Colors.muted },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  index: { width: 18, color: Colors.brand, fontWeight: '800' },
  name: { fontWeight: '700', color: Colors.heading },
  addr: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  pill: {
    backgroundColor: Colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { color: Colors.brand, fontWeight: '800', fontSize: 11 },
});
