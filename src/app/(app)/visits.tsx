import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { DateField } from '@/components/ui/DateField';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
import { formatDate } from '@/lib/format';
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
          Tap a dealer to see location, then Check-in / Check-out. Completed visits are in history.
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

        {pending.map((visit) => (
          <Pressable
            key={visit.id}
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/visit-detail',
                params: {
                  visitId: visit.id,
                  dealerName: visit.dealer_name ?? 'Dealer',
                  checkedIn: visit.reached_at ? '1' : '0',
                  reachedAt: visit.reached_at ?? '',
                  day,
                },
              })
            }>
            <Text style={styles.name}>{visit.dealer_name ?? 'Dealer'}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
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
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 16, flex: 1 },
});
