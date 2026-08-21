import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius } from '@/constants/theme';
import { listDealers, type Dealer } from '@/lib/api/dealers';
import { formatClock, formatDate } from '@/lib/format';
import { formatDistanceKm } from '@/lib/geo';
import { getActiveVisit, visitsForDay, type VisitLog } from '@/lib/visits';

type StopStatus = 'visited' | 'active' | 'pending' | 'upcoming';

interface Stop {
  dealer: Dealer;
  status: StopStatus;
  visitedAt?: string;
  distanceM: number | null;
}

export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [logs, setLogs] = useState<VisitLog[]>([]);
  const [active, setActive] = useState<VisitLog | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    const [dealerRes, dayLogs, activeVisit] = await Promise.all([
      listDealers().catch(() => ({ items: [] as Dealer[] })),
      visitsForDay(),
      getActiveVisit(),
    ]);
    setDealers(dealerRes.items);
    setLogs(dayLogs);
    setActive(activeVisit);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const stops = useMemo(() => {
    const completed = new Map(logs.filter((v) => v.checkOutAt).map((v) => [v.dealerId, v]));
    const q = query.trim().toLowerCase();
    const list = dealers.filter((d) => !q || d.name.toLowerCase().includes(q) || (d.address ?? '').toLowerCase().includes(q));
    let pendingAssigned = false;
    return list.map((dealer, index): Stop => {
      const done = completed.get(dealer.id);
      if (done) {
        return {
          dealer,
          status: 'visited',
          visitedAt: done.checkInAt,
          distanceM: done.distanceMeters ?? null,
        };
      }
      if (active?.dealerId === dealer.id) {
        return { dealer, status: 'active', distanceM: active.distanceMeters ?? null };
      }
      if (!pendingAssigned) {
        pendingAssigned = true;
        return { dealer, status: 'pending', distanceM: null };
      }
      return { dealer, status: index < 4 ? 'pending' : 'upcoming', distanceM: null };
    });
  }, [dealers, logs, active, query]);

  const visitedCount = stops.filter((s) => s.status === 'visited').length;

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.title}>Today's Visits</Text>
          <Text style={styles.date}>{formatDate(new Date())}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.meta}>
            {visitedCount} of {stops.length || dealers.length} visited
          </Text>
          <Pressable onPress={() => setSearchOpen((v) => !v)} hitSlop={8}>
            <Ionicons name="search" size={22} color={Colors.heading} />
          </Pressable>
        </View>
      </View>
      {searchOpen ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search dealer"
          placeholderTextColor={Colors.muted}
          style={styles.search}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {stops.length === 0 ? (
          <Text style={styles.empty}>No dealers assigned for today.</Text>
        ) : (
          stops.map((stop, index) => (
            <Pressable
              key={stop.dealer.id}
              style={styles.row}
              onPress={() => {
                if (stop.status === 'active' && active) {
                  router.push({ pathname: '/visit-check-out', params: { visitId: active.id } });
                  return;
                }
                router.push({ pathname: '/dealer-detail', params: { id: stop.dealer.id } });
              }}>
              <Text style={styles.index}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{stop.dealer.name}</Text>
                <Text style={styles.addr} numberOfLines={1}>
                  {stop.dealer.address || [stop.dealer.area_name, stop.dealer.city_name].filter(Boolean).join(', ') || '—'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <StatusPill status={stop.status} time={stop.visitedAt} />
                <Text style={styles.km}>{formatDistanceKm(stop.distanceM)}</Text>
              </View>
            </Pressable>
          ))
        )}
        <Pressable style={styles.historyLink} onPress={() => router.push('/visit-history')}>
          <Text style={styles.historyText}>Visit History</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.brand} />
        </Pressable>
      </ScrollView>

      <Pressable style={[styles.fab, { bottom: insets.bottom + 88 }]} onPress={() => router.push('/unplanned-visit')}>
        <Text style={styles.fabText}>+ Unplanned Visit</Text>
      </Pressable>
    </View>
  );
}

function StatusPill({ status, time }: { status: StopStatus; time?: string }) {
  const map = {
    visited: {
      label: time ? `Visited ${formatClock(time)}` : 'Visited',
      bg: Colors.visitedBg,
      color: Colors.visitedText,
    },
    active: { label: 'Active Pulse', bg: Colors.pendingBg, color: Colors.pendingText },
    pending: { label: 'Pending', bg: Colors.infoBg, color: Colors.infoText },
    upcoming: { label: 'Upcoming', bg: Colors.borderLight, color: Colors.muted },
  } as const;
  const item = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: item.bg }]}>
      <Text style={[styles.pillText, { color: item.color }]}>{item.label}</Text>
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
    alignItems: 'flex-start',
  },
  title: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  date: { color: Colors.muted, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  meta: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 44,
    color: Colors.heading,
  },
  list: { paddingHorizontal: 16, paddingBottom: 140, gap: 8 },
  empty: { color: Colors.muted, marginTop: 24 },
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
  km: { color: Colors.muted, fontSize: 11 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 10, fontWeight: '700' },
  historyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
  },
  historyText: { color: Colors.brand, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.brand,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  fabText: { color: '#fff', fontWeight: '800' },
});
