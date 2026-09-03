import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getMyHistory, type AttendanceRecord } from '@/lib/api/attendance';
import { getMyLeaveRequests, type LeaveRequest } from '@/lib/api/leave';
import { formatClock, hoursToLabel, monthKey } from '@/lib/format';
import { displayYmd } from '@/lib/leaveUi';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
type DayFilter = 'all' | 'present' | 'absent' | 'leave';

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isWeekend(iso: string) {
  const weekday = new Date(`${iso}T00:00:00`).getDay();
  return weekday === 0 || weekday === 6;
}

export default function AttendanceCalendarScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<DayFilter>('all');

  const today = new Date();
  const todayIso = isoDay(today.getFullYear(), today.getMonth(), today.getDate());
  const [selectedIso, setSelectedIso] = useState(todayIso);

  const key = monthKey(cursor);

  const load = useCallback(async () => {
    const [month, mine] = await Promise.all([
      getMyHistory(90).catch(() => ({ items: [] as AttendanceRecord[] })),
      getMyLeaveRequests().catch(() => [] as LeaveRequest[]),
    ]);
    setRecords(month.items);
    setLeaves(mine.filter((item) => item.status !== 'rejected'));
  }, [key]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const byDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of records) map.set(record.date.slice(0, 10), record);
    return map;
  }, [records]);

  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    for (const req of leaves) {
      const from = new Date(`${req.from_date}T00:00:00`);
      const to = new Date(`${req.to_date}T00:00:00`);
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        set.add(d.toISOString().slice(0, 10));
      }
    }
    return set;
  }, [leaves]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const total = daysInMonth(cursor);
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [...Array(mondayOffset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const label = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function dayKind(iso: string): DayFilter | 'future' | 'weekend' {
    if (iso > todayIso) return 'future';
    const onLeave = leaveDays.has(iso);
    const record = byDate.get(iso);
    if (onLeave) return 'leave';
    if (record) return 'present';
    if (iso === todayIso) return 'absent';
    if (isWeekend(iso)) return 'weekend';
    return 'absent';
  }

  function matchesFilter(iso: string) {
    if (filter === 'all') return true;
    const kind = dayKind(iso);
    if (kind === 'future' || kind === 'weekend') return false;
    return kind === filter;
  }

  const selectedRecord = byDate.get(selectedIso) ?? null;
  const selectedOnLeave = leaveDays.has(selectedIso);
  const selectedLeave = leaves.find(
    (req) => selectedIso >= req.from_date.slice(0, 10) && selectedIso <= req.to_date.slice(0, 10),
  );

  let present = 0;
  let late = 0;
  let absent = 0;
  let leaveCount = 0;
  let hours = 0;

  for (let day = 1; day <= total; day += 1) {
    const iso = isoDay(year, month, day);
    const record = byDate.get(iso);
    const onLeave = leaveDays.has(iso);
    const future = iso > todayIso;
    if (onLeave) leaveCount += 1;
    if (record) {
      present += 1;
      if (record.late_flag) late += 1;
      hours += record.working_hours ?? 0;
    } else if (!onLeave && !future && iso !== todayIso && !isWeekend(iso)) {
      absent += 1;
    }
  }

  const empty = records.length === 0 && leaves.length === 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="My Attendance" onBack={() => router.replace('/(app)/clock')} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.monthNav}>
          <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={Colors.heading} />
          </Pressable>
          <Text style={styles.month}>{label}</Text>
          <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))} hitSlop={8}>
            <Ionicons name="chevron-forward" size={22} color={Colors.heading} />
          </Pressable>
          <Pressable
            style={styles.todayBtn}
            onPress={() => {
              const now = new Date();
              setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedIso(todayIso);
            }}>
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          {(['all', 'present', 'absent', 'leave'] as DayFilter[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}>
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
                {item === 'all' ? 'All' : item === 'leave' ? 'On leave' : item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {empty ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={40} color={Colors.muted} />
            <Text style={styles.emptyTitle}>No attendance records yet</Text>
            <Text style={styles.emptyCopy}>
              Your daily attendance and logged hours will appear here once you start clocking in.
            </Text>
            <OutlineButton label="Go to Clock" onPress={() => router.replace('/(app)/clock')} />
          </View>
        ) : (
          <>
            <View style={styles.week}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={styles.weekDay}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (!day) return <View key={`e-${index}`} style={styles.cell} />;
                const iso = isoDay(year, month, day);
                const record = byDate.get(iso);
                const onLeave = leaveDays.has(iso);
                const isToday = iso === todayIso;
                const isSelected = iso === selectedIso;
                const kind = dayKind(iso);
                const isAbsent = kind === 'absent';
                const dimmed = filter !== 'all' && !matchesFilter(iso);
                return (
                  <Pressable key={iso} style={styles.cell} onPress={() => setSelectedIso(iso)}>
                    <View
                      style={[
                        styles.day,
                        isToday && styles.today,
                        isAbsent && styles.absent,
                        isSelected && styles.selected,
                        dimmed && styles.dimmed,
                      ]}>
                      <Text style={[styles.dayText, isAbsent && styles.absentText]}>{day}</Text>
                      <View style={styles.dots}>
                        {record?.late_flag ? (
                          <View style={[styles.dot, { backgroundColor: Colors.pendingText }]} />
                        ) : null}
                        {record?.early_flag ? (
                          <View style={[styles.dot, { backgroundColor: Colors.brand }]} />
                        ) : null}
                        {onLeave ? (
                          <View style={[styles.dot, { backgroundColor: Colors.leaveBorder }]} />
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legend}>
              <Legend color={Colors.border} label="Present" />
              <Legend color={Colors.absentBg} border={Colors.danger} label="Absent" />
              <Legend color={Colors.background} border={Colors.leaveBorder} label="Leave" />
              <Legend color={Colors.pendingText} dot label="Late" />
            </View>

            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>
                {selectedIso === todayIso ? 'Today' : displayYmd(selectedIso)}
              </Text>
              {selectedOnLeave && selectedLeave ? (
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>On leave</Text>
                  <Text style={styles.detailValue}>{selectedLeave.leave_type_name ?? 'Leave'}</Text>
                  <Text style={styles.detailMeta}>
                    {displayYmd(selectedLeave.from_date)} – {displayYmd(selectedLeave.to_date)} ·{' '}
                    {selectedLeave.status}
                  </Text>
                </View>
              ) : null}
              {selectedRecord ? (
                <>
                  <DetailRow label="Clock in" value={formatClock(selectedRecord.clock_in_time)} />
                  <DetailRow
                    label="Clock out"
                    value={formatClock(selectedRecord.clock_out_time)}
                  />
                  <DetailRow
                    label="Working hours"
                    value={hoursToLabel(selectedRecord.working_hours)}
                  />
                  <DetailRow
                    label="Flags"
                    value={[
                      selectedRecord.late_flag ? 'Late' : null,
                      selectedRecord.early_flag ? 'Early out' : null,
                      selectedRecord.status !== 'present' ? selectedRecord.status : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'None'}
                  />
                </>
              ) : !selectedOnLeave ? (
                <Text style={styles.detailEmpty}>No clock-in recorded for this date.</Text>
              ) : null}
            </View>

            <View style={styles.stats}>
              <View style={styles.statsHead}>
                <Text style={styles.statsTitle}>Month summary</Text>
                <Text style={styles.hours}>{hoursToLabel(hours)} total</Text>
              </View>
              <View style={styles.statsRow}>
                <Stat value={present} label="Present" color={Colors.heading} />
                <Stat value={late} label="Late" color={Colors.pendingText} />
                <Stat value={absent} label="Absent" color={Colors.danger} />
                <Stat value={leaveCount} label="Leave" color={Colors.leaveBorder} />
              </View>
            </View>

            <PrimaryButton label="Request Correction" onPress={() => router.push('/request-correction')} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Legend({
  color,
  label,
  border,
  dot,
}: {
  color: string;
  label: string;
  border?: string;
  dot?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          dot ? styles.legendDot : styles.legendBox,
          { backgroundColor: color, borderColor: border ?? color },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  month: { flex: 1, fontWeight: '800', fontSize: 16, textAlign: 'center', color: Colors.heading },
  todayBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  todayBtnText: { fontSize: 12, fontWeight: '700', color: Colors.heading },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  filterTextActive: { color: '#fff' },
  week: { flexDirection: 'row', marginTop: 4 },
  weekDay: { flex: 1, textAlign: 'center', color: Colors.muted, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: Colors.leaveBorder },
  selected: { backgroundColor: Colors.brandSoft, borderWidth: 2, borderColor: Colors.brand },
  absent: { backgroundColor: Colors.absentBg },
  dimmed: { opacity: 0.35 },
  dayText: { fontWeight: '700', color: Colors.heading },
  absentText: { color: Colors.danger },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.muted, fontSize: 12 },
  detailCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 8,
    marginTop: 4,
  },
  detailTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  detailBlock: { gap: 2, marginBottom: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  detailLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  detailValue: { fontWeight: '700', color: Colors.heading },
  detailMeta: { color: Colors.muted, fontSize: 12 },
  detailEmpty: { color: Colors.muted, fontSize: 13 },
  stats: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 12,
  },
  statsHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statsTitle: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.muted,
  },
  hours: { color: Colors.brand, fontWeight: '800' },
  statsRow: { flexDirection: 'row' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.muted, fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  emptyCopy: { textAlign: 'center', color: Colors.muted, lineHeight: 20 },
});
