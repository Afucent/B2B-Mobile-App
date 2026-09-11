import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

import { OutlineButton } from '@/components/ui/OutlineButton';
import RequireModuleAccess from '@/components/RequireModuleAccess';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  getAttendanceTrail,
  getEmployeeLiveDetail,
  getEmployeeMonthAttendance,
  getEmployeeTrailByDate,
  type EmployeeLiveDetail,
  type EmployeeMonthAttendance,
  type LocationTrailPoint,
} from '@/lib/api/fieldOps';
import { formatClock, formatLiveStatus } from '@/lib/format';
import { displayYmd, ymd } from '@/lib/leaveUi';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function sourceLabel(source: string) {
  const key = source.replace(/_/g, ' ');
  if (source === 'start_location') return 'start location';
  if (source === 'end_location') return 'end location';
  if (source === 'periodic') return 'periodic';
  if (source === 'clock_in') return 'clock in';
  if (source === 'clock_out') return 'clock out';
  return key;
}

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminLiveEmployeeScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const bottomInset = useContentBottomInset();
  const [data, setData] = useState<EmployeeLiveDetail | null>(null);
  const [day, setDay] = useState(() => ymd(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [points, setPoints] = useState<LocationTrailPoint[]>([]);
  const [monthAtt, setMonthAtt] = useState<EmployeeMonthAttendance | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!employeeId) return;
    setLogsLoading(true);
    setError('');
    try {
      const live = await getEmployeeLiveDetail(employeeId).catch(() => null);
      if (live) setData(live);

      let trail = await getEmployeeTrailByDate(employeeId, day);
      let nextPoints = trail.points ?? [];

      // Fallback: today empty but live detail has an active session record.
      const today = ymd(new Date());
      if (
        day === today &&
        nextPoints.length === 0 &&
        live?.attendance_record_id
      ) {
        trail = await getAttendanceTrail(live.attendance_record_id);
        nextPoints = trail.points ?? [];
      }

      setPoints(nextPoints);

      const att = await getEmployeeMonthAttendance(employeeId, monthKey()).catch(() => null);
      setMonthAtt(att);
    } catch (err) {
      setPoints([]);
      setError(err instanceof Error ? err.message : 'Failed to load location logs');
    } finally {
      setLogsLoading(false);
      setLoading(false);
    }
  }, [employeeId, day]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  const logs = useMemo(() => [...points].reverse(), [points]);
  const isToday = day === ymd(new Date());

  const kpiRows = useMemo(() => {
    if (!data) return [];
    const rows: { label: string; value: string }[] = [];
    if (data.late_minutes != null) rows.push({ label: 'Late', value: `${data.late_minutes} min` });
    if (data.working_duration_label)
      rows.push({ label: 'Working', value: data.working_duration_label });
    if (data.distance_today_km != null)
      rows.push({ label: 'Distance today', value: `${data.distance_today_km} km` });
    if (data.visits_completed != null || data.visits_assigned != null) {
      rows.push({
        label: 'Visits',
        value: `${data.visits_completed ?? 0}/${data.visits_assigned ?? 0}`,
      });
    }
    if (data.battery_percent != null)
      rows.push({ label: 'Battery', value: `${data.battery_percent}%` });
    if (data.gps_status) rows.push({ label: 'GPS', value: data.gps_status });
    return rows;
  }, [data]);

  return (
    <RequireModuleAccess module="live_location">
      <SafeScreen>
        <ScreenHeader
          title={data?.employee_name ?? 'Live location'}
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <View style={[styles.field, styles.fieldBorder]}>
              <Text style={styles.label}>Status</Text>
              {data?.status ? (
                <StatusPill
                  label={formatLiveStatus(data.status) || data.status}
                  tone={statusTone(data.status)}
                />
              ) : (
                <Text style={styles.value}>—</Text>
              )}
            </View>
            <Row label="Designation" value={data?.designation ?? '—'} />
            <Row label="Clock in" value={data?.clock_in_time ? formatClock(data.clock_in_time) : '—'} />
            <Row
              label="Last update"
              value={data?.last_ping_at ? formatClock(data.last_ping_at) : '—'}
            />
            <Row label="Address" value={data?.address ?? '—'} last={kpiRows.length === 0} />
            {kpiRows.map((row, i) => (
              <Row key={row.label} label={row.label} value={row.value} last={i === kpiRows.length - 1} />
            ))}
          </View>

          {data?.latitude != null && data?.longitude != null ? (
            <OutlineButton
              label="View on map"
              onPress={() =>
                router.push({
                  pathname: '/visit-map',
                  params: {
                    lat: String(data.latitude),
                    lon: String(data.longitude),
                    title: data.employee_name ?? 'Live location',
                    subtitle: data.address ?? '',
                  },
                })
              }
            />
          ) : null}

          {(data?.visits?.length ?? 0) > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionInCard}>Today&apos;s visits</Text>
              {data!.visits!.map((visit, index) => (
                <View
                  key={visit.id}
                  style={[
                    styles.visitRow,
                    index < data!.visits!.length - 1 && styles.fieldBorder,
                  ]}>
                  <View style={styles.visitHead}>
                    <Text style={styles.value}>{visit.dealer_name ?? 'Dealer'}</Text>
                    {visit.status ? (
                      <StatusPill label={visit.status} tone={statusTone(visit.status)} />
                    ) : null}
                  </View>
                  {visit.scheduled_at ? (
                    <Text style={styles.sub}>{formatClock(visit.scheduled_at)}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.linkRow}>
            <OutlineButton
              label="Visit history"
              onPress={() =>
                router.push({
                  pathname: '/visit-history',
                  params: employeeId ? { employeeId } : undefined,
                })
              }
            />
          </View>

          {monthAtt && monthAtt.days.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.sectionInCard}>Month attendance ({monthAtt.month})</Text>
              {monthAtt.days.map((d, index) => (
                <View
                  key={d.date}
                  style={[styles.attRow, index < monthAtt.days.length - 1 && styles.fieldBorder]}>
                  <Text style={styles.value}>{displayYmd(d.date)}</Text>
                  <StatusPill label={d.status} tone={statusTone(d.status)} />
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.logHeader}>
            <Text style={styles.section}>Location log ({logs.length})</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
              <Text style={styles.dateLabel}>Date</Text>
              <Text style={styles.dateValue}>
                {isToday ? `Today · ${displayYmd(day)}` : displayYmd(day)}
              </Text>
            </Pressable>
          </View>

          {showPicker ? (
            <DateTimePicker
              value={new Date(`${day}T00:00:00`)}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, date) => {
                setShowPicker(Platform.OS === 'ios');
                if (date) setDay(ymd(date));
              }}
            />
          ) : null}

          <View style={styles.card}>
            {logsLoading ? <Text style={[styles.meta, styles.emptyLog]}>Loading logs…</Text> : null}
            {!logsLoading && logs.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No location pings</Text>
                <Text style={styles.emptyCopy}>
                  Nothing recorded for {isToday ? 'today' : displayYmd(day)}. Pick another date or
                  wait for the next update.
                </Text>
              </View>
            ) : null}
            {!logsLoading
              ? logs.map((point, index) => (
                  <View
                    key={point.id}
                    style={[styles.logRow, index < logs.length - 1 && styles.fieldBorder]}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={styles.value}>{formatWhen(point.captured_at)}</Text>
                      <Text style={styles.sub}>
                        {point.address ||
                          `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`}
                      </Text>
                    </View>
                    <Text style={styles.source}>{sourceLabel(point.source)}</Text>
                  </View>
                ))
              : null}
          </View>
        </ScrollView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.field, !last && styles.fieldBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: Spacing.md },
  logHeader: { gap: Spacing.sm },
  section: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  sectionInCard: {
    fontWeight: '800',
    color: Colors.heading,
    padding: Spacing.md,
    paddingBottom: 0,
  },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  emptyLog: { padding: Spacing.md },
  emptyWrap: { padding: Spacing.lg, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  linkRow: { gap: Spacing.sm },
  dateBtn: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateValue: { color: Colors.heading, fontWeight: '700' },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  field: { paddingVertical: 14, paddingHorizontal: Spacing.md, gap: 4 },
  fieldBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontWeight: '600', fontSize: 15 },
  sub: { color: Colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  visitRow: { paddingVertical: 14, paddingHorizontal: Spacing.md, gap: 6 },
  visitHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  attRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  logRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  source: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
