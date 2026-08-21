import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { APP_VERSION, Colors, Radius } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  getEmployeeLiveDetail,
  getMyRecords,
  getTodayStatus,
  pingLocation,
  type AttendanceRecord,
  type EmployeeLiveDetail,
  type TodayStatus,
} from '@/lib/api/attendance';
import { listDealers, type Dealer } from '@/lib/api/dealers';
import { getLeaveBalance } from '@/lib/api/leave';
import { getFieldOperationsSettings } from '@/lib/api/org';
import {
  durationLabel,
  employeeCode,
  firstName,
  formatClock,
  formatDate,
  formatKm,
  greetingForNow,
  initials,
  monthKey,
} from '@/lib/format';
import { requestLocation } from '@/lib/location';
import { routeForLocationAction } from '@/lib/locationGate';
import { getMissedClockOut, saveMissedClockOut } from '@/lib/visits';

interface RouteStop {
  id: string;
  name: string;
  address: string;
  visited: boolean;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [live, setLive] = useState<EmployeeLiveDetail | null>(null);
  const [route, setRoute] = useState<RouteStop[]>([]);
  const [leaveDays, setLeaveDays] = useState(0);
  const [now, setNow] = useState(new Date());
  const [missedOpen, setMissedOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const status = await getTodayStatus().catch(() => null);
    setToday(status);
    const liveDetail = await getEmployeeLiveDetail(user.id).catch(() => null);
    setLive(liveDetail);

    const dealers = await listDealers().catch(() => null);
    const completedNames = new Set(
      (liveDetail?.visits ?? [])
        .filter((visit) => visit.status === 'completed')
        .map((visit) => visit.store_name.toLowerCase()),
    );

    if (dealers?.items?.length) {
      setRoute(
        dealers.items.map((dealer: Dealer) => ({
          id: dealer.id,
          name: dealer.name,
          address: [dealer.address, dealer.area_name, dealer.city_name].filter(Boolean).join(', '),
          visited: completedNames.has(dealer.name.toLowerCase()),
        })),
      );
    } else if (liveDetail?.visits?.length) {
      setRoute(
        liveDetail.visits.map((visit) => ({
          id: visit.id,
          name: visit.store_name,
          address: visit.duration_label,
          visited: visit.status === 'completed',
        })),
      );
    } else {
      setRoute([]);
    }

    const balance = await getLeaveBalance().catch(() => null);
    setLeaveDays(balance?.items.reduce((sum, item) => sum + (item.balance || 0), 0) ?? 0);

    const existing = await getMissedClockOut();
    if (existing?.dismissed) {
      setMissedOpen(false);
    } else if (existing) {
      setMissedOpen(true);
    } else {
      const records = await getMyRecords(monthKey(new Date())).catch(() => null);
      const autoClosed = records?.items.find((item) => {
        if (!item.clock_out_time) return false;
        const hour = new Date(item.clock_out_time).getHours();
        return hour >= 21 || item.status === 'auto_closed';
      });
      if (autoClosed) {
        const settings = await getFieldOperationsSettings().catch(() => null);
        await saveMissedClockOut({
          id: autoClosed.id,
          date: String(autoClosed.date),
          expectedOut: settings?.shift_end_time
            ? formatClock(new Date(`1970-01-01T${settings.shift_end_time}:00`).toISOString())
            : '06:00 PM',
          autoOut: formatClock(autoClosed.clock_out_time),
          status: 'FLAGGED_REVIEW',
        });
        setMissedOpen(true);
      } else {
        setMissedOpen(false);
      }
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!today?.tracking_active) return;
    let cancelled = false;
    async function ping() {
      try {
        const loc = await requestLocation();
        if (!cancelled) {
          await pingLocation(loc.latitude, loc.longitude, loc.accuracy ?? undefined);
        }
      } catch {
        // Keep the dashboard usable if a background ping fails.
      }
    }
    void ping();
    const timer = setInterval(() => void ping(), 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [today?.tracking_active]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  async function goWithLocation(next: '/clock-in' | '/clock-out') {
    const block = await routeForLocationAction(next);
    router.push(block ?? next);
  }

  const onDuty = Boolean(today?.is_clocked_in);
  const record: AttendanceRecord | null = today?.record ?? null;
  const visitedCount = route.filter((stop) => stop.visited).length;
  const name = user?.name ?? 'there';

  return (
    <View style={styles.flex}>
      {onDuty ? (
        <View style={[styles.tracking, { paddingTop: insets.top + 6 }]}>
          <Ionicons name="navigate" size={14} color={Colors.trackingText} />
          <Text style={styles.trackingText}>TRACKING ACTIVE  ·  GPS ONLINE</Text>
        </View>
      ) : (
        <View style={{ height: insets.top, backgroundColor: Colors.background }} />
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
        <View style={styles.topRow}>
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.logo}>AFBEX</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>v{APP_VERSION}</Text>
              </View>
            </View>
            <Text style={styles.hello}>
              {greetingForNow()}, {firstName(name)}
            </Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={styles.iconBtn} onPress={() => router.push('/notifications')}>
              <Ionicons name="notifications-outline" size={22} color={Colors.heading} />
            </Pressable>
            <Pressable onPress={() => router.push('/(app)/profile')}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials(name)}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.statusDotWrap}>
              <View style={[styles.statusDot, onDuty ? styles.dotOn : styles.dotIdle]} />
              <Text style={styles.statusLabel}>
                Status: {onDuty ? 'On Duty' : 'Idle'}
              </Text>
            </View>
            <Text style={styles.empId}>{live?.employee_code ?? employeeCode(user?.id ?? '')}</Text>
          </View>

          {onDuty && record ? (
            <>
              <View style={styles.metrics}>
                <View>
                  <Text style={styles.metricLabel}>Clocked in since:</Text>
                  <Text style={styles.metricValueLg}>{formatClock(record.clock_in_time)}</Text>
                </View>
              </View>
              <View style={styles.metricSplit}>
                <View>
                  <Text style={styles.metricLabel}>Duration</Text>
                  <Text style={styles.metricValue}>
                    {live?.working_duration_label ?? durationLabel(record.clock_in_time, now)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metricLabel}>Distance</Text>
                  <Text style={styles.metricValue}>{formatKm(live?.distance_today_km)}</Text>
                </View>
              </View>
              <PrimaryButton label="Clock Out" onPress={() => void goWithLocation('/clock-out')} />
            </>
          ) : (
            <>
              <Text style={styles.shiftLabel}>Shift schedule for today:</Text>
              <Text style={styles.shiftValue}>
                {formatDate(new Date())}  ·  09:00–18:00
              </Text>
              <PrimaryButton label="Clock In" onPress={() => void goWithLocation('/clock-in')} />
            </>
          )}
        </View>

        {missedOpen ? (
          <Pressable style={styles.missed} onPress={() => router.push('/missed-clock-out')}>
            <Ionicons name="warning" size={18} color={Colors.pendingText} />
            <View style={{ flex: 1 }}>
              <Text style={styles.missedTitle}>Missed clock-out</Text>
              <Text style={styles.missedCopy}>Your last shift was auto-closed. Tap to review.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Today’s Route</Text>
          <Text style={styles.sectionMeta}>
            {visitedCount} of {route.length || live?.visits_assigned || 0} visited
          </Text>
        </View>

        <View style={styles.routeCard}>
          {route.length === 0 ? (
            <Text style={styles.empty}>No stops assigned for today.</Text>
          ) : (
            route.map((stop, index) => (
              <Pressable
                key={stop.id}
                style={styles.stopRow}
                onPress={() => router.push({ pathname: '/dealer-detail', params: { id: stop.id } })}>
                <Text style={styles.stopIndex}>{index + 1}</Text>
                <View style={styles.stopCopy}>
                  <Text style={styles.stopName}>{stop.name}</Text>
                  <Text style={styles.stopAddress} numberOfLines={1}>
                    {stop.address || '—'}
                  </Text>
                </View>
                <View style={[styles.pill, stop.visited ? styles.pillVisited : styles.pillPending]}>
                  <Text style={[styles.pillText, stop.visited ? styles.pillVisitedText : styles.pillPendingText]}>
                    {stop.visited ? 'Visited' : 'Pending'}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <Pressable style={styles.leaveCard} onPress={() => router.push({ pathname: '/leave-balance' })}>
          <View style={styles.leaveIcon}>
            <Ionicons name="calendar-outline" size={18} color={Colors.brand} />
          </View>
          <Text style={styles.leaveLabel}>Leave Balance</Text>
          <Text style={styles.leaveValue}>{leaveDays} days</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  tracking: {
    backgroundColor: Colors.trackingBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  trackingText: {
    color: Colors.trackingText,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontSize: 26, fontWeight: '800', color: Colors.brand },
  badge: {
    backgroundColor: Colors.brandSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: Colors.brand, fontSize: 11, fontWeight: '700' },
  hello: { marginTop: 4, color: Colors.muted, fontSize: 15 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotIdle: { backgroundColor: Colors.muted },
  dotOn: { backgroundColor: Colors.success },
  statusLabel: { color: Colors.muted, fontSize: 13 },
  empId: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  shiftLabel: { color: Colors.muted, fontSize: 13 },
  shiftValue: { color: Colors.heading, fontSize: 16, fontWeight: '700', marginTop: -6 },
  metrics: { marginTop: 4 },
  metricLabel: { color: Colors.muted, fontSize: 12 },
  metricValueLg: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  metricValue: { fontSize: 20, fontWeight: '800', color: Colors.heading },
  metricSplit: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  sectionMeta: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  routeCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 12,
    gap: 4,
  },
  empty: { color: Colors.muted, padding: 12 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  stopIndex: { width: 18, color: Colors.brand, fontWeight: '800' },
  stopCopy: { flex: 1 },
  stopName: { fontWeight: '700', color: Colors.heading },
  stopAddress: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillVisited: { backgroundColor: Colors.visitedBg },
  pillPending: { backgroundColor: Colors.pendingBg },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillVisitedText: { color: Colors.visitedText },
  pillPendingText: { color: Colors.pendingText },
  leaveCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  leaveIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveLabel: { flex: 1, fontWeight: '700', color: Colors.heading },
  leaveValue: { fontWeight: '800', color: Colors.heading, marginRight: 4 },
  missed: {
    backgroundColor: Colors.pendingBg,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  missedTitle: { fontWeight: '800', color: Colors.heading },
  missedCopy: { color: Colors.text, fontSize: 12, marginTop: 2 },
});
