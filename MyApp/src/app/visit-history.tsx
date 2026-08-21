import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius } from '@/constants/theme';
import { formatClock, formatDate } from '@/lib/format';
import { durationClock } from '@/lib/geo';
import { listVisits, type VisitLog } from '@/lib/visits';

type Filter = 'all' | 'week' | 'month' | 'flagged';

export default function VisitHistoryScreen() {
  const [items, setItems] = useState<VisitLog[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      void listVisits().then((rows) => setItems(rows.filter((v) => v.checkOutAt)));
    }, []),
  );

  const filtered = useMemo(() => {
    const now = new Date();
    return items.filter((item) => {
      const date = new Date(item.checkOutAt || item.checkInAt);
      if (filter === 'flagged') return item.flagged;
      if (filter === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - 7);
        return date >= start;
      }
      if (filter === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [items, filter]);

  const avg = (() => {
    if (!filtered.length) return '—';
    const mins =
      filtered.reduce((sum, item) => {
        if (!item.checkOutAt) return sum;
        return sum + (new Date(item.checkOutAt).getTime() - new Date(item.checkInAt).getTime()) / 60000;
      }, 0) / filtered.length;
    return `${Math.round(mins)}m`;
  })();

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Visit History" onBack={() => router.back()} />
      <Text style={styles.sub}>Your completed dealer visits logs</Text>
      <View style={styles.filters}>
        {(
          [
            ['all', 'All'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['flagged', 'Flagged'],
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
      <View style={styles.stats}>
        <Text style={styles.stat}>Total  {filtered.length} visits</Text>
        <Text style={styles.stat}>Avg duration  {avg}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>No completed visits yet.</Text>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.when}>
                  {formatDate(item.checkInAt)} · {formatClock(item.checkInAt)}
                </Text>
                <Text style={styles.name}>{item.dealerName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <View
                  style={[
                    styles.pill,
                    item.flagged ? styles.flag : item.unplanned ? styles.unplanned : styles.ok,
                  ]}>
                  <Text
                    style={[
                      styles.pillText,
                      item.flagged ? styles.flagText : item.unplanned ? styles.unplannedText : styles.okText,
                    ]}>
                    {item.flagged ? 'Flagged Mismatch' : item.unplanned ? 'Unplanned Complete' : 'Completed'}
                  </Text>
                </View>
                <Text style={styles.dur}>{item.checkOutAt ? durationClock(item.checkInAt, item.checkOutAt) : '—'}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  sub: { textAlign: 'center', color: Colors.muted, marginTop: -6, marginBottom: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  chipOn: { backgroundColor: Colors.brandSoft },
  chipText: { fontSize: 12, fontWeight: '700', color: Colors.muted },
  chipOnText: { color: Colors.brand },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stat: { color: Colors.muted, fontWeight: '600', fontSize: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { color: Colors.muted, marginTop: 16 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 10,
  },
  when: { color: Colors.muted, fontSize: 12 },
  name: { fontWeight: '800', color: Colors.heading, marginTop: 4 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  ok: { backgroundColor: Colors.visitedBg },
  flag: { backgroundColor: Colors.pendingBg },
  unplanned: { backgroundColor: Colors.surfaceWarm },
  pillText: { fontSize: 10, fontWeight: '700' },
  okText: { color: Colors.visitedText },
  flagText: { color: Colors.pendingText },
  unplannedText: { color: Colors.accentCoral },
  dur: { color: Colors.muted, fontSize: 12, fontWeight: '700' },
});
