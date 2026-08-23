import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  getLeaveCalendar,
  listActiveLeaveTypes,
  type CalendarEmployeeRow,
  type LeaveCalendarResponse,
  type LeaveTypeAdmin,
} from '@/lib/api/leaveAdmin';
import { listUsers, type AdminUser } from '@/lib/api/users';
import { monthKey } from '@/lib/format';
import { displayYmd, displayYmdRange, leaveStatusMeta } from '@/lib/leaveUi';

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function AdminLeaveCalendarScreen() {
  return (
    <RequireModuleAccess module="team_calendar">
      <TeamCalendarContent />
    </RequireModuleAccess>
  );
}

function TeamCalendarContent() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date());
  const [data, setData] = useState<LeaveCalendarResponse | null>(null);
  const [types, setTypes] = useState<LeaveTypeAdmin[]>([]);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const key = monthKey(cursor);
  const selectedIso = isoDay(year, month, selectedDay);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([listActiveLeaveTypes(), listUsers(0, 100)])
        .then(([typeItems, userData]) => {
          setTypes(typeItems);
          setEmployees(userData.items);
        })
        .catch(() => {});
    }, []),
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getLeaveCalendar({
        month: key,
        leave_type_id: typeFilter === 'all' ? undefined : typeFilter,
        employee_id: employeeFilter === 'all' ? undefined : employeeFilter,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [key, typeFilter, employeeFilter]);

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

  const dayLeaves = useMemo(() => {
    if (!data) return [] as Array<CalendarEmployeeRow & { entry: CalendarEmployeeRow['leaves'][number] }>;
    const rows: Array<CalendarEmployeeRow & { entry: CalendarEmployeeRow['leaves'][number] }> = [];
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
        <Text style={styles.subtitle}>Organisation leave — who is off and when.</Text>

        <View style={styles.monthNav}>
          <Pressable onPress={() => { setCursor(new Date(year, month - 1, 1)); setSelectedDay(1); }} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.heading} />
          </Pressable>
          <Text style={styles.month}>{monthLabel}</Text>
          <Pressable onPress={() => { setCursor(new Date(year, month + 1, 1)); setSelectedDay(1); }} hitSlop={8}>
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

        <FilterSelect
          label="Employee"
          value={employeeFilter}
          onChange={setEmployeeFilter}
          options={[{ id: 'all', name: 'All employees' }, ...employees.map((e) => ({ id: e.id, name: e.name }))]}
        />
        <FilterSelect
          label="Leave type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[{ id: 'all', name: 'All types' }, ...types.map((t) => ({ id: t.id, name: t.name }))]}
        />

        {data ? (
          <View style={styles.summaryRow}>
            <SummaryCard label="On leave today" value={String(data.summary.on_leave_today)} />
            <SummaryCard label="Pending" value={String(data.summary.pending_requests)} />
            <SummaryCard label="Approved this week" value={String(data.summary.approved_this_week)} />
            <SummaryCard label="Team strength" value={`${data.summary.team_strength_percent}%`} />
          </View>
        ) : null}

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
            return (
              <Pressable key={day} style={styles.cell} onPress={() => setSelectedDay(day)}>
                <View style={[styles.day, selected && styles.daySelected]}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
                  {count > 0 ? (
                    <Text style={[styles.leaveCount, selected && styles.dayTextSelected]}>{count} off</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>
          {displayYmd(selectedIso)} · {dayLeaves.length} on leave
        </Text>
        {loading ? <Text style={styles.meta}>Loading calendar…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: Spacing.sm },
  subtitle: { color: Colors.muted, lineHeight: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  month: { flex: 1, fontWeight: '800', fontSize: 16, textAlign: 'center', color: Colors.heading },
  todayBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: Colors.heading },
  filterWrap: { gap: 6 },
  filterLabel: { fontSize: 11, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase' },
  filterRow: { gap: 8 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 180,
  },
  filterChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  filterTextActive: { color: '#fff' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summaryCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  summaryLabel: { color: Colors.muted, fontSize: 11 },
  summaryValue: { fontSize: 20, fontWeight: '800', color: Colors.heading, marginTop: 4 },
  week: { flexDirection: 'row', marginTop: 4 },
  weekDay: { flex: 1, textAlign: 'center', color: Colors.muted, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: Colors.background, borderRadius: Radius.lg, padding: 8 },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  daySelected: { backgroundColor: Colors.brand },
  dayText: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  dayTextSelected: { color: '#fff' },
  leaveCount: { fontSize: 8, color: Colors.pendingText, fontWeight: '700', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: Colors.heading, marginTop: 8 },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  leaveRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
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
