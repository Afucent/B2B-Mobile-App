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
import { formatClock, hoursToLabel } from '@/lib/format';
import { displayYmd, ymd } from '@/lib/leaveUi';

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
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [board, setBoard] = useState<AttendanceDayBoard | null>(null);
  const [selfRows, setSelfRows] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canViewAll) {
        const [sum, dayBoard] = await Promise.all([
          getAttendanceDashboardSummary(day).catch(() => null),
          getAttendanceDayBoard(day),
        ]);
        setSummary(sum);
        setBoard(dayBoard);
        setSelfRows([]);
      } else {
        const history = await getMyHistory(90);
        const mine = history.items.filter((r) => r.date.slice(0, 10) === day);
        setSelfRows(mine);
        setBoard(null);
        setSummary({
          present: mine.length > 0 ? 1 : 0,
          on_leave: 0,
          absent: mine.length === 0 ? 1 : 0,
          total_users: 1,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setBoard(null);
      setSelfRows([]);
    } finally {
      setLoading(false);
    }
  }, [day, canViewAll]);

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

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Attendance" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
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
          <StatCard label="On leave" value={summary?.on_leave} />
          <StatCard label="Clocked in" value={canViewAll ? board?.clocked_in : rows.length} />
          <StatCard
            label="Clocked out"
            value={
              canViewAll
                ? (board?.clocked_out ?? rows.filter((r) => r.clockOut).length)
                : rows.filter((r) => r.clockOut).length
            }
          />
        </View>

        <Text style={styles.section}>Clock in / clock out</Text>
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && rows.length === 0 ? (
          <Text style={styles.meta}>No attendance records for this day.</Text>
        ) : (
          rows.map((row) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.name}>{row.name}</Text>
              {row.designation ? <Text style={styles.sub}>{row.designation}</Text> : null}
              <View style={styles.times}>
                <TimeCol label="Clock in" value={formatClock(row.clockIn)} />
                <TimeCol label="Clock out" value={formatClock(row.clockOut)} />
                <TimeCol label="Hours" value={hoursToLabel(row.hours ?? null)} />
              </View>
              <View style={styles.badges}>
                {row.onLocation ? (
                  <Text style={[styles.badge, styles.badgeOn]}>On location</Text>
                ) : null}
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
});
