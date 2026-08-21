import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius } from '@/constants/theme';
import { getMyRecords, type AttendanceRecord } from '@/lib/api/attendance';
import { getMyLeaveRequests, type LeaveRequest } from '@/lib/api/leave';
import { hoursToLabel, monthKey } from '@/lib/format';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function isoDay(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function AttendanceCalendarScreen() {
  const insets = useSafeAreaInsets();
  const [cursor, setCursor] = useState(() => new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  const key = monthKey(cursor);

  const load = useCallback(async () => {
    const [month, mine] = await Promise.all([
      getMyRecords(key).catch(() => ({ items: [] as AttendanceRecord[] })),
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
  const today = new Date();
  const todayIso = isoDay(today.getFullYear(), today.getMonth(), today.getDate());

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
    } else if (!onLeave && !future && iso !== todayIso) {
      const weekday = new Date(`${iso}T00:00:00`).getDay();
      if (weekday !== 0 && weekday !== 6) absent += 1;
    }
  }

  const empty = records.length === 0 && leaves.length === 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <View style={styles.nav}>
        <Text style={styles.title}>My Attendance</Text>
        <View style={styles.monthNav}>
          <Pressable onPress={() => setCursor(new Date(year, month - 1, 1))}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{label}</Text>
          <Pressable onPress={() => setCursor(new Date(year, month + 1, 1))}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekDay}>
            {d}
          </Text>
        ))}
      </View>

      {empty ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyGlyph}>▦</Text>
          </View>
          <Text style={styles.emptyTitle}>No attendance records yet</Text>
          <Text style={styles.emptyCopy}>
            Your daily attendance and logged hours will appear here once you start clocking in.
          </Text>
          <OutlineButton label="Go to Dashboard" onPress={() => router.replace('/(app)')} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (!day) return <View key={`e-${index}`} style={styles.cell} />;
              const iso = isoDay(year, month, day);
              const record = byDate.get(iso);
              const onLeave = leaveDays.has(iso);
              const isToday = iso === todayIso;
              const isAbsent = !record && !onLeave && iso < todayIso && ![0, 6].includes(new Date(`${iso}T00:00:00`).getDay());
              return (
                <Pressable
                  key={iso}
                  style={styles.cell}
                  onPress={() => router.push('/request-correction')}>
                  <View
                    style={[
                      styles.day,
                      isToday && styles.today,
                      isAbsent && styles.absent,
                    ]}>
                    <Text style={[styles.dayText, isAbsent && styles.absentText]}>{day}</Text>
                    <View style={styles.dots}>
                      {record?.late_flag ? <View style={[styles.dot, { backgroundColor: Colors.pendingText }]} /> : null}
                      {record?.early_flag ? <View style={[styles.dot, { backgroundColor: Colors.brand }]} /> : null}
                      {onLeave ? <View style={[styles.dot, { backgroundColor: Colors.leaveBorder }]} /> : null}
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
            <Legend color={Colors.brand} dot label="Early Out" />
          </View>

          <View style={styles.stats}>
            <View style={styles.statsHead}>
              <Text style={styles.statsTitle}>Summary stats</Text>
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
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.heading },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { fontSize: 26, color: Colors.heading, paddingHorizontal: 4 },
  month: { fontWeight: '700', minWidth: 110, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', color: Colors.muted, fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 40,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 2, borderColor: Colors.leaveBorder, backgroundColor: Colors.background },
  absent: { backgroundColor: Colors.absentBg },
  dayText: { fontWeight: '700', color: Colors.heading },
  absentText: { color: Colors.danger },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.muted, fontSize: 12 },
  stats: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 12,
  },
  statsHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statsTitle: { fontWeight: '800', fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: Colors.muted },
  hours: { color: Colors.brand, fontWeight: '800' },
  statsRow: { flexDirection: 'row' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.muted, fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 12, paddingHorizontal: 24 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyph: { fontSize: 22, color: Colors.muted },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyCopy: { textAlign: 'center', color: Colors.muted, lineHeight: 20 },
});
