import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  getAttendanceTrail,
  getEmployeeLiveDetail,
  getEmployeeTrailByDate,
  type EmployeeLiveDetail,
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

export default function AdminLiveEmployeeScreen() {
  const { employeeId } = useLocalSearchParams<{ employeeId: string }>();
  const [data, setData] = useState<EmployeeLiveDetail | null>(null);
  const [day, setDay] = useState(() => ymd(new Date()));
  const [showPicker, setShowPicker] = useState(false);
  const [points, setPoints] = useState<LocationTrailPoint[]>([]);
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

  return (
    <RequireModuleAccess module="live_location">
      <View style={styles.flex}>
        <ScreenHeader
          title={data?.employee_name ?? 'Live location'}
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={styles.body}>
          {loading ? <Text style={styles.meta}>Loading…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.card}>
            <Row label="Status" value={formatLiveStatus(data?.status) || data?.status || '—'} />
            <Row label="Designation" value={data?.designation ?? '—'} />
            <Row label="Clock in" value={data?.clock_in_time ? formatClock(data.clock_in_time) : '—'} />
            <Row
              label="Last update"
              value={data?.last_ping_at ? formatClock(data.last_ping_at) : '—'}
            />
            <Row label="Address" value={data?.address ?? '—'} last />
          </View>

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
              <Text style={[styles.meta, styles.emptyLog]}>
                No location pings for {isToday ? 'today' : displayYmd(day)}.
              </Text>
            ) : null}
            {!logsLoading
              ? logs.map((point, index) => (
                  <View
                    key={point.id}
                    style={[styles.logRow, index < logs.length - 1 && styles.fieldBorder]}>
                    <View style={{ flex: 1 }}>
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
      </View>
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
  flex: { flex: 1, backgroundColor: Colors.surface },
  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  logHeader: { gap: Spacing.sm },
  section: { fontWeight: '800', color: Colors.heading },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  emptyLog: { padding: Spacing.md },
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
  field: { padding: Spacing.md, gap: 2 },
  fieldBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  value: { color: Colors.heading, fontWeight: '600' },
  sub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  logRow: {
    padding: Spacing.md,
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
