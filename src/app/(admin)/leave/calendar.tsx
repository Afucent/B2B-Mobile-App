import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getEmployeeMonthAttendance } from '@/lib/api/fieldOps';
import { getLeaveCalendar, type CalendarEmployeeRow, type LeaveCalendarResponse } from '@/lib/api/leaveAdmin';
import { listAssignableRoles, listUsers, type AdminUser, type RoleOption } from '@/lib/api/users';
import { monthKey } from '@/lib/format';
import { displayYmd, displayYmdRange, leaveStatusMeta } from '@/lib/leaveUi';

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekdayName(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day)
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();
}

function isOrgAdminRole(name: string) {
  const key = name.trim().toLowerCase().replace(/\s+/g, '_');
  return key === 'organization_admin' || key === 'tenant_admin' || key === 'platform_super_admin';
}

type DayMark = 'leave' | 'present' | 'absent';

export default function AdminLeaveCalendarScreen() {
  return (
    <RequireModuleAccess module="team_calendar">
      <TeamCalendarContent />
    </RequireModuleAccess>
  );
}

function TeamCalendarContent() {
  const insets = useSafeAreaInsets();
  const { isOrgAdmin, canEdit, canCreate, canView } = usePermissions();
  const canViewAll =
    isOrgAdmin || canEdit('leave_requests') || canCreate('leave_types') || canView('users');
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState<LeaveCalendarResponse | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [attendanceMarks, setAttendanceMarks] = useState<Map<string, DayMark>>(new Map());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const key = monthKey(cursor);
  const selectedIso = isoDay(year, month, selectedDay);

  const usersForRole = useMemo(() => {
    if (roleFilter === 'all') return employees;
    return employees.filter((employee) => employee.roles?.some((role) => role.id === roleFilter));
  }, [employees, roleFilter]);

  useEffect(() => {
    if (employeeFilter !== 'all' && !usersForRole.some((employee) => employee.id === employeeFilter)) {
      setEmployeeFilter('all');
    }
  }, [employeeFilter, usersForRole]);

  useFocusEffect(
    useCallback(() => {
      void listAssignableRoles()
        .then((items) => setRoles(items.filter((role) => !isOrgAdminRole(role.name))))
        .catch(() => setRoles([]));
      if (canViewAll) {
        void listUsers(0, 200)
          .then((userData) =>
            setEmployees(userData.items.filter((employee) => !employee.roles?.some((role) => isOrgAdminRole(role.name)))),
          )
          .catch(() => setEmployees([]));
      } else {
        setEmployees([]);
        setEmployeeFilter('all');
      }
    }, [canViewAll]),
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    setAttendanceMarks(new Map());
    try {
      const employeeId = canViewAll && employeeFilter !== 'all' ? employeeFilter : undefined;
      const res = await getLeaveCalendar({ month: key, employee_id: employeeId });
      setData(res);
      if (employeeId) {
        const attendance = await getEmployeeMonthAttendance(employeeId, key).catch(() => null);
        const marks = new Map<string, DayMark>();
        const workingDays = new Set(
          attendance?.working_days ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        );
        for (const day of attendance?.days ?? []) {
          marks.set(day.date, day.status === 'present' ? 'present' : 'absent');
        }
        const employee = res.employees[0];
        for (const entry of employee?.leaves ?? []) {
          if (entry.status !== 'approved') continue;
          const from = new Date(`${entry.from_date}T00:00:00`);
          const to = new Date(`${entry.to_date}T00:00:00`);
          for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
            const date = isoDay(day.getFullYear(), day.getMonth(), day.getDate());
            if (workingDays.has(weekdayName(date))) marks.set(date, 'leave');
          }
        }
        setAttendanceMarks(marks);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [key, employeeFilter, canViewAll]);

  useFocusEffect(
    useCallback(() => {
      void loadCalendar();
    }, [loadCalendar]),
  );

  const total = daysInMonth(cursor);
  const sundayOffset = new Date(year, month, 1).getDay();
  const cells = [...Array(sundayOffset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const dayLeaveMap = useMemo(() => {
    const map = new Map<number, number>();
    if (!data) return map;
    for (const employee of data.employees) {
      for (const entry of employee.leaves) {
        for (let day = 1; day <= total; day += 1) {
          const iso = isoDay(year, month, day);
          if (entry.from_date <= iso && entry.to_date >= iso) {
            map.set(day, (map.get(day) ?? 0) + 1);
          }
        }
      }
    }
    return map;
  }, [data, total, year, month]);

  const stats = useMemo(() => {
    const values = { leave: 0, present: 0, absent: 0 };
    attendanceMarks.forEach((mark) => { values[mark] += 1; });
    return values;
  }, [attendanceMarks]);

  const dayLeaves = useMemo(() => {
    if (!data) return [] as (CalendarEmployeeRow & { entry: CalendarEmployeeRow['leaves'][number] })[];
    const rows: (CalendarEmployeeRow & { entry: CalendarEmployeeRow['leaves'][number] })[] = [];
    for (const employee of data.employees) {
      for (const entry of employee.leaves) {
        if (entry.from_date <= selectedIso && entry.to_date >= selectedIso) {
          rows.push({ ...employee, entry });
        }
      }
    }
    return rows;
  }, [data, selectedIso]);

  return (
    <View style={styles.flex}>
        <ScreenHeader title="Team calendar" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.intro}>
          <View style={styles.introIcon}>
            <Ionicons name="calendar-outline" size={22} color={Colors.brand} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Leave & attendance</Text>
            <Text style={styles.subtitle}>
              {canViewAll
                ? 'Organisation leave — who is off and when.'
                : 'Your leave only — pending and approved requests.'}
            </Text>
          </View>
        </View>

        <View style={styles.monthNav}>
          <Pressable style={styles.navButton} onPress={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(1); }} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.heading} />
          </Pressable>
          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthEyebrow}>VIEWING</Text>
            <Text style={styles.month}>{monthLabel}</Text>
          </View>
          <Pressable style={styles.navButton} onPress={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(1); }} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={Colors.heading} />
          </Pressable>
          <Pressable
            style={styles.todayBtn}
            onPress={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDay(now.getDate());
            }}>
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
        </View>

       
          <View style={styles.filtersCard}>
            <View style={styles.filtersHeading}>
              <Ionicons name="options-outline" size={16} color={Colors.brand} />
              <Text style={styles.filtersTitle}>Filter calendar</Text>
            </View>
            <FilterSelect
              label="Role"
              value={roleFilter}
              onChange={(value) => { setRoleFilter(value); setEmployeeFilter('all'); }}
              options={[{ id: 'all', name: 'All roles' }, ...roles.map((role) => ({ id: role.id, name: role.name }))]}
            />
            <FilterSelect
              label="Employee"
              value={employeeFilter}
              onChange={setEmployeeFilter}
              options={[{ id: 'all', name: 'All employees' }, ...usersForRole.map((employee) => ({ id: employee.id, name: employee.name }))]}
            />
          </View>

        {data ? (
          <View style={styles.summaryRow}>
            {employeeFilter !== 'all' ? (
              <>
                <SummaryCard label="Leave" value={String(stats.leave)} color={Colors.pendingText} />
                <SummaryCard label="Present" value={String(stats.present)} color={Colors.success} />
                <SummaryCard label="Absent" value={String(stats.absent)} color={Colors.danger} />
              </>
            ) : (
              <>
                <SummaryCard label="On leave today" value={String(data.summary.on_leave_today)} />
                <SummaryCard label="Pending" value={String(data.summary.pending_requests)} />
                <SummaryCard label="Approved this week" value={String(data.summary.approved_this_week)} />
                <SummaryCard label="Team strength" value={`${data.summary.team_strength_percent}%`} />
              </>
            )}
          </View>
        ) : null}

        {employeeFilter !== 'all' ? (
          <View style={styles.legend}>
            <LegendDot color={Colors.pendingText} label="Leave" />
            <LegendDot color={Colors.success} label="Present" />
            <LegendDot color={Colors.danger} label="Absent" />
          </View>
        ) : null}

        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Calendar</Text>
            <Text style={styles.calendarHint}>Tap a day for details</Text>
          </View>
          <View style={styles.week}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <Text key={d} style={styles.weekDay}>{d}</Text>
            ))}
          </View>
          <View style={styles.grid}>
          {cells.map((day, index) => {
            if (!day) return <View key={`e-${index}`} style={styles.cell} />;
            const count = dayLeaveMap.get(day) ?? 0;
            const selected = day === selectedDay;
            const mark = employeeFilter === 'all' ? undefined : attendanceMarks.get(isoDay(year, month, day));
            const markColor = mark === 'leave'
              ? Colors.pendingText
              : mark === 'present'
                ? Colors.success
                : mark === 'absent'
                  ? Colors.danger
                  : undefined;
            return (
              <Pressable key={day} style={styles.cell} onPress={() => setSelectedDay(day)}>
                <View style={[styles.day, markColor ? { backgroundColor: `${markColor}18` } : null, selected && styles.daySelected]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                  {mark ? (
                    <Text style={[styles.markText, { color: selected ? '#fff' : markColor }]}>{mark}</Text>
                  ) : count > 0 ? (
                    <Text style={[styles.leaveCount, selected && styles.dayTextSelected]}>{count} off</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
          </View>
        </View>

        <View style={styles.detailsHeader}>
          <View>
            <Text style={styles.sectionKicker}>SELECTED DAY</Text>
            <Text style={styles.sectionTitle}>{displayYmd(selectedIso)}</Text>
          </View>
          <View style={styles.dayCount}>
            <Text style={styles.dayCountValue}>{dayLeaves.length}</Text>
            <Text style={styles.dayCountLabel}>on leave</Text>
          </View>
        </View>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.brand} />
            <Text style={styles.meta}>Loading calendar…</Text>
          </View>
        ) : null}
        {error ? (
          <Text style={styles.error}>
            {error === 'Request failed'
              ? 'Could not load leave calendar. Check team calendar permission or try again.'
              : error}
          </Text>
        ) : null}
        {!loading && dayLeaves.length === 0 ? (
          <Text style={styles.meta}>No leave entries for this day.</Text>
        ) : (
          dayLeaves.map((row) => {
            const meta = leaveStatusMeta(row.entry.status);
            return (
              <View key={`${row.employee_id}-${row.entry.request_id}`} style={styles.leaveRow}>
                <Text style={styles.empName}>{row.employee_name}</Text>
                <Text style={styles.leaveType}>{row.entry.leave_type_name}</Text>
                <Text style={styles.leaveDates}>
                  {displayYmdRange(row.entry.from_date, row.entry.to_date)} · {row.entry.days} day
                  {row.entry.days === 1 ? '' : 's'}
                </Text>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <View style={styles.filterWrap}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {options.map((opt) => (
          <Pressable
            key={opt.id}
            style={[styles.filterChip, value === opt.id && styles.filterChipActive]}
            onPress={() => onChange(opt.id)}>
            <Text style={[styles.filterText, value === opt.id && styles.filterTextActive]} numberOfLines={1}>
              {opt.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function SummaryCard({ label, value, color = Colors.brand }: { label: string; value: string; color?: string }) {
  return (
    <View style={[styles.summaryCard, { borderLeftColor: color }]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: 14 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.brandSoft, borderRadius: Radius.lg, padding: 14 },
  introIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, gap: 3 },
  introTitle: { color: Colors.heading, fontSize: 15, fontWeight: '800' },
  subtitle: { color: Colors.muted, lineHeight: 18, fontSize: 12 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: Colors.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  navButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  monthLabelWrap: { flex: 1, alignItems: 'center', gap: 2 },
  monthEyebrow: { color: Colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  month: { fontWeight: '800', fontSize: 16, textAlign: 'center', color: Colors.heading },
  todayBtn: { borderWidth: 1, borderColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: 11, paddingVertical: 8 },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: Colors.heading },
  filtersCard: { gap: 14, backgroundColor: Colors.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  filtersHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filtersTitle: { color: Colors.heading, fontSize: 14, fontWeight: '800' },
  filterWrap: { gap: 7 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  filterRow: { gap: 8 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 180,
  },
  filterChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  filterTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  summaryLabel: { color: Colors.muted, fontSize: 11 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.heading, marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.muted, fontSize: 11, fontWeight: '600' },
  calendarCard: { backgroundColor: Colors.background, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: 10, gap: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  calendarTitle: { color: Colors.heading, fontSize: 14, fontWeight: '800' },
  calendarHint: { color: Colors.muted, fontSize: 10 },
  week: { flexDirection: 'row', marginTop: 2 },
  weekDay: { flex: 1, textAlign: 'center', color: Colors.muted, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 6 },
  cell: { width: '14.28%', aspectRatio: 0.9, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  day: { width: '92%', minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 5 },
  daySelected: { backgroundColor: Colors.brand },
  dayText: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  dayTextSelected: { color: '#fff' },
  leaveCount: { fontSize: 8, color: Colors.pendingText, fontWeight: '700', marginTop: 2 },
  markText: { fontSize: 8, fontWeight: '700', marginTop: 2, textTransform: 'capitalize' },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionKicker: { fontSize: 10, fontWeight: '800', color: Colors.muted, letterSpacing: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.heading, marginTop: 3 },
  dayCount: { alignItems: 'flex-end', backgroundColor: Colors.brandSoft, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 7 },
  dayCountValue: { fontSize: 16, fontWeight: '800', color: Colors.brand },
  dayCountLabel: { fontSize: 10, color: Colors.infoText, fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  leaveRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: 14,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  empName: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  leaveType: { color: Colors.brand, fontWeight: '700' },
  leaveDates: { color: Colors.muted, fontSize: 12 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
