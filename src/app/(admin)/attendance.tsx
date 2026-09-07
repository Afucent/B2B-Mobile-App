import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getMyHistory, type AttendanceRecord } from '@/lib/api/attendance';
import {
  getAttendanceDashboardSummary,
  getAttendanceDayBoard,
  type AttendanceDayBoard,
  type AttendanceDayEntry,
  type AttendanceSummary,
} from '@/lib/api/fieldOps';
import { getMyLeaveRequests } from '@/lib/api/leave';
import { getLeaveCalendar } from '@/lib/api/leaveAdmin';
import { formatClock, hoursToLabel } from '@/lib/format';
import { displayYmd, displayYmdRange, leaveStatusMeta, ymd } from '@/lib/leaveUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type BoardFilter = 'all' | 'on' | 'off' | 'leave';

const FILTERS: {
  id: BoardFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'all', label: 'All clocked in', icon: 'people-outline' },
  { id: 'on', label: 'On location', icon: 'location-outline' },
  { id: 'off', label: 'Off location', icon: 'locate-outline' },
  { id: 'leave', label: 'On leave', icon: 'calendar-outline' },
];

function coversDay(from: string, to: string, day: string) {
  return from.slice(0, 10) <= day && to.slice(0, 10) >= day;
}

export default function AdminAttendanceScreen() {
  return (
    <RequireModuleAccess module="attendance">
      <AttendanceContent />
    </RequireModuleAccess>
  );
}

function AttendanceContent() {
  const { user } = useAuth();
  const { isOrgAdmin, canView } = usePermissions();
  /** Admin or Users permission → everyone’s clock-in/out; else self only. */
  const canViewAll = isOrgAdmin || canView('users');

  const [day, setDay] = useState(() => ymd(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [board, setBoard] = useState<AttendanceDayBoard | null>(null);
  const [selfRows, setSelfRows] = useState<AttendanceRecord[]>([]);
  const [leaveRows, setLeaveRows] = useState<
    Array<{
      key: string;
      name: string;
      leaveType: string;
      from: string;
      to: string;
      days: number;
      status: string;
    }>
  >([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canViewAll) {
        const [sum, dayBoard, calendar] = await Promise.all([
          getAttendanceDashboardSummary(day).catch(() => null),
          getAttendanceDayBoard(day),
          getLeaveCalendar({ month: day.slice(0, 7) }).catch(() => null),
        ]);
        setSummary(sum);
        setBoard(dayBoard);
        console.log('board', dayBoard);
        console.log('summary', sum);
        setSelfRows([]);
        const fromCal =
          calendar?.employees.flatMap((employee) =>
            employee.leaves
              .filter(
                (entry) =>
                  entry.status.toLowerCase() === 'approved' &&
                  coversDay(entry.from_date, entry.to_date, day),
              )
              .map((entry) => ({
                key: `${employee.employee_id}-${entry.request_id}`,
                name: employee.employee_name,
                leaveType: entry.leave_type_name,
                from: entry.from_date,
                to: entry.to_date,
                days: entry.days,
                status: entry.status,
              })),
          ) ?? [];
        setLeaveRows(fromCal);
      } else {
        const [history, myLeaves] = await Promise.all([
          getMyHistory(90),
          getMyLeaveRequests().catch(() => []),
        ]);
        const mine = history.items.filter((r) => r.date.slice(0, 10) === day);
        setSelfRows(mine);
        setBoard(null);
        const onLeave = myLeaves.filter(
          (leave) =>
            leave.status.toLowerCase() === 'approved' &&
            coversDay(leave.from_date, leave.to_date, day),
        );
        setLeaveRows(
          onLeave.map((leave) => ({
            key: leave.id,
            name: user?.name ?? 'You',
            leaveType: leave.leave_type_name,
            from: leave.from_date,
            to: leave.to_date,
            days: leave.number_of_days,
            status: leave.status,
          })),
        );
        setSummary({
          present: mine.length > 0 ? 1 : 0,
          on_leave: onLeave.length,
          absent: mine.length === 0 && onLeave.length === 0 ? 1 : 0,
          total_users: 1,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setBoard(null);
      setSelfRows([]);
      setLeaveRows([]);
    } finally {
      setLoading(false);
    }
  }, [day, canViewAll, user?.name]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows: Array<{
    key: string;
    name: string;
    designation?: string | null;
    clockIn: string | null;
    clockOut: string | null;
    hours: number | null | undefined;
    status?: string | null;
    onLocation?: boolean;
    employeeId?: string;
  }> = useMemo(() => {
    if (canViewAll) {
      return (board?.items ?? []).map((item: AttendanceDayEntry) => ({
        key: item.attendance_record_id,
        name: item.employee_name,
        designation: item.designation,
        clockIn: item.clock_in_time,
        clockOut: item.clock_out_time ?? null,
        hours: item.working_hours,
        status: item.status,
        onLocation: item.on_location,
        employeeId: item.employee_id,
      }));
    }
    return selfRows.map((r) => ({
      key: r.id,
      name: user?.name ?? 'You',
      designation: user?.designation,
      clockIn: r.clock_in_time,
      clockOut: r.clock_out_time,
      hours: r.working_hours,
      status: r.status,
      onLocation: r.location_tracking_enabled && !r.clock_out_time,
      employeeId: r.employee_id,
    }));
  }, [canViewAll, board, selfRows, user]);

  const filteredRows = useMemo(() => {
    if (filter === 'on') return rows.filter((r) => r.onLocation);
    if (filter === 'off') return rows.filter((r) => !r.onLocation);
    return rows;
  }, [rows, filter]);

  const filterCounts: Record<BoardFilter, number> = {
    all: board?.clocked_in ?? rows.length,
    on: board?.on_location ?? rows.filter((r) => r.onLocation).length,
    off: board?.off_location ?? rows.filter((r) => !r.onLocation).length,
    leave: leaveRows.length,
  };

  const emptyCopy =
    filter === 'on'
      ? 'No one on location for this day.'
      : filter === 'off'
        ? 'No one off location for this day.'
        : filter === 'leave'
          ? 'No one on leave for this day.'
          : 'No attendance records for this day.';

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Attendance" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 20 }]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}>
        <Text style={styles.subtitle}>
          {canViewAll
            ? 'Organisation attendance — clock in and clock out times.'
            : 'Your attendance only — clock in and clock out.'}
        </Text>

        <Pressable style={styles.dateBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.dateLabel}>Date</Text>
          <Text style={styles.dateValue}>{displayYmd(day)}</Text>
        </Pressable>
        {showPicker ? (
          <DateTimePicker
            value={new Date(`${day}T00:00:00`)}
            mode="date"
            onChange={(_, date) => {
              setShowPicker(Platform.OS === 'ios');
              if (date) setDay(ymd(date));
            }}
          />
        ) : null}

        <View style={styles.grid}>
          <StatCard label="Present" value={summary?.present} />
          <StatCard label="Absent" value={summary?.absent} />
          {/* <StatCard label="On leave" value={summary?.on_leave} /> */}
          {/* <StatCard label="Clocked in" value={canViewAll ? board?.clocked_in : rows.length} /> */}
          {/* <StatCard
            label="Clocked out"
            value={
              canViewAll
                ? (board?.clocked_out ?? rows.filter((r) => r.clockOut).length)
                : rows.filter((r) => r.clockOut).length
            }
          /> */}
        </View>

        <Text style={styles.section}>
          {filter === 'leave' ? 'On leave' : 'Clock in / clock out'}
        </Text>
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const active = filter === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.label}, ${filterCounts[item.id]}`}
                onPress={() => setFilter(item.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}>
                <Ionicons
                  name={item.icon}
                  size={14}
                  color={active ? Colors.brand : Colors.muted}
                />
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {item.label}
                </Text>
                <Text style={[styles.filterCount, active && styles.filterCountActive]}>
                  {filterCounts[item.id]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {filter === 'leave' ? (
          !loading && leaveRows.length === 0 ? (
            <Text style={styles.meta}>{emptyCopy}</Text>
          ) : (
            leaveRows.map((row) => {
              const meta = leaveStatusMeta(row.status);
              return (
                <View key={row.key} style={styles.row}>
                  <Text style={styles.name}>{row.name}</Text>
                  <Text style={styles.sub}>{row.leaveType}</Text>
                  <Text style={styles.sub}>
                    {displayYmdRange(row.from, row.to)} · {row.days} day
                    {row.days === 1 ? '' : 's'}
                  </Text>
                  <View style={styles.badges}>
                    <Text style={[styles.badge, { color: meta.color, backgroundColor: meta.bg }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>
              );
            })
          )
        ) : !loading && filteredRows.length === 0 ? (
          <Text style={styles.meta}>{emptyCopy}</Text>
        ) : (
          filteredRows.map((row) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.name}>{row.name}</Text>
              {row.designation ? <Text style={styles.sub}>{row.designation}</Text> : null}
              <View style={styles.times}>
                <TimeCol label="Clock in" value={formatClock(row.clockIn)} />
                <TimeCol label="Clock out" value={formatClock(row.clockOut)} />
                <TimeCol label="Hours" value={hoursToLabel(row.hours ?? null)} />
              </View>
              <View style={styles.badges}>
                <Text style={[styles.badge, row.onLocation ? styles.badgeOn : styles.badgeOff]}>
                  {row.onLocation ? 'On location' : 'Off location'}
                </Text>
                {row.status ? (
                  <Text style={styles.badge}>{row.status.replace(/_/g, ' ')}</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value?: number | null }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimeCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeCol}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  subtitle: { color: Colors.muted, lineHeight: 20 },
  dateBtn: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  dateValue: { marginTop: 4, fontSize: 16, fontWeight: '800', color: Colors.heading },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  stat: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  statLabel: { marginTop: 4, color: Colors.muted, fontSize: 12, fontWeight: '600' },
  section: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brandSoft,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  filterTextActive: { color: Colors.brand, fontWeight: '700' },
  filterCount: { fontSize: 11, fontWeight: '800', color: Colors.muted },
  filterCountActive: { color: Colors.brand },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  sub: { color: Colors.muted, fontSize: 12 },
  times: { flexDirection: 'row', marginTop: 6, gap: 8 },
  timeCol: { flex: 1 },
  timeLabel: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  timeValue: { marginTop: 2, fontWeight: '700', color: Colors.heading },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    textTransform: 'capitalize',
  },
  badgeOn: { color: '#166534', backgroundColor: '#DCFCE7' },
  badgeOff: { color: Colors.muted, backgroundColor: Colors.surface },
});
