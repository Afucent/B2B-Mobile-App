import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import LocationMap from '@/components/LocationMap';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getAttendanceDashboardSummary,
  getLiveTrackingPanel,
  type AttendanceSummary,
  type LiveEmployeeRow,
  type LiveTrackingPanel,
} from '@/lib/api/fieldOps';
import { getUserFilterOptions, getUserSummary } from '@/lib/api/users';
import { formatLiveStatus } from '@/lib/format';

type AttendanceRange = 'today' | 'yesterday' | 'custom';

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const STATUS_COLOR: Record<string, string> = {
  active: '#2E7D32',
  in_transit: '#1976D2',
  idle: '#ED6C02',
  gps_off: '#ED6C02',
  offline: '#757575',
};

type Props = {
  refreshKey?: number;
};

export default function DashboardStats({ refreshKey = 0 }: Props) {
  const { canView } = usePermissions();
  const canUsers = canView('users');
  const canLive = canView('live_location');
  const canAttendance = canView('attendance');

  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRange>('today');
  const [customDate, setCustomDate] = useState(() => ymd(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [panel, setPanel] = useState<LiveTrackingPanel | null>(null);
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const attendanceDate = useMemo(() => {
    if (attendanceRange === 'today') return ymd(new Date());
    if (attendanceRange === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return ymd(d);
    }
    return customDate;
  }, [attendanceRange, customDate]);

  const loadBase = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [summary, live, filters] = await Promise.all([
        canUsers ? getUserSummary().catch(() => null) : Promise.resolve(null),
        canLive ? getLiveTrackingPanel().catch(() => null) : Promise.resolve(null),
        canUsers || canLive
          ? getUserFilterOptions().catch(() => ({ cities: [] as string[], areas: [] as string[] }))
          : Promise.resolve({ cities: [] as string[], areas: [] as string[] }),
      ]);
      if (summary) {
        setTotalUsers(summary.total_users || summary.total_active + summary.total_inactive);
        setActiveUsers(summary.total_active);
      }
      setPanel(live);
      setCities(filters.cities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [canUsers, canLive]);

  const loadAttendance = useCallback(async () => {
    if (!canAttendance) {
      setAttendance(null);
      return;
    }
    try {
      setAttendance(await getAttendanceDashboardSummary(attendanceDate));
    } catch {
      setAttendance(null);
    }
  }, [attendanceDate, canAttendance]);

  useFocusEffect(
    useCallback(() => {
      void loadBase();
      void loadAttendance();
    }, [loadBase, loadAttendance]),
  );

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (refreshKey === 0) return;
    void loadBase();
    void loadAttendance();
  }, [refreshKey, loadBase, loadAttendance]);

  const mapItems = useMemo(() => {
    const items = panel?.items ?? [];
    if (cityFilter === 'all') return items;
    return items.filter((item) => (item.city ?? '').toLowerCase() === cityFilter.toLowerCase());
  }, [panel, cityFilter]);

  const mapCities = useMemo(() => {
    const fromLive = (panel?.items ?? [])
      .map((i) => i.city)
      .filter((c): c is string => Boolean(c && c.trim()));
    return Array.from(new Set([...cities, ...fromLive])).sort();
  }, [panel, cities]);

  const markers = useMemo(
    () =>
      mapItems
        .filter((item) => item.last_latitude != null && item.last_longitude != null)
        .map((item) => ({
          id: item.employee_id,
          latitude: item.last_latitude as number,
          longitude: item.last_longitude as number,
          label: item.employee_name,
          color: STATUS_COLOR[item.status ?? 'offline'] ?? STATUS_COLOR.offline,
        })),
    [mapItems],
  );

  const center = markers[0] ?? { latitude: 28.6139, longitude: 77.209 };

  const hasAny = canUsers || canAttendance || canLive;
  if (!hasAny) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Organisation dashboard</Text>
      {loading ? <Text style={styles.meta}>Loading dashboard…</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {(canUsers || canAttendance) && (
        <View style={styles.grid}>
          {canUsers ? (
            <>
              <StatCard
                label="Total users"
                value={totalUsers}
                onPress={() => router.push('/(admin)/users')}
              />
              <StatCard
                label="Active users"
                value={activeUsers}
                onPress={() => router.push('/(admin)/users')}
              />
            </>
          ) : null}
          {canAttendance ? (
            <>
              <StatCard
                label="Present today"
                value={attendance?.present}
                onPress={() => router.push('/(admin)/attendance')}
              />
              <StatCard
                label="On leave"
                value={attendance?.on_leave}
                onPress={() => router.push('/(admin)/leave/requests')}
              />
            </>
          ) : null}
        </View>
      )}

      {canAttendance ? (
        <View style={styles.card}>
          <View>
            <Text style={styles.cardTitle}>Daily attendance</Text>
            <Text style={styles.cardSub}>Present · leave · absent</Text>
          </View>
          <View style={styles.rangeRow}>
            {(['today', 'yesterday', 'custom'] as AttendanceRange[]).map((key) => (
              <Pressable
                key={key}
                style={[styles.rangeChip, attendanceRange === key && styles.rangeChipActive]}
                onPress={() => {
                  setAttendanceRange(key);
                  if (key === 'custom') setShowDatePicker(true);
                }}>
                <Text
                  style={[styles.rangeText, attendanceRange === key && styles.rangeTextActive]}>
                  {key}
                </Text>
              </Pressable>
            ))}
          </View>
          {attendanceRange === 'custom' ? (
            <Pressable style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateBtnText}>{customDate}</Text>
            </Pressable>
          ) : null}
          {showDatePicker ? (
            <DateTimePicker
              value={new Date(customDate)}
              mode="date"
              onChange={(_, date) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (date) {
                  setCustomDate(ymd(date));
                  setAttendanceRange('custom');
                }
              }}
            />
          ) : null}
          {attendance ? (
            <AttendancePie
              present={attendance.present}
              onLeave={attendance.on_leave}
              absent={attendance.absent}
            />
          ) : (
            <Text style={styles.meta}>No attendance data.</Text>
          )}
        </View>
      ) : null}

      {canLive ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => router.push('/(admin)/live-tracking')}>
              <Text style={styles.cardTitle}>Live activity map</Text>
              <Text style={styles.cardSub}>
                Clocked-in users · refresh {panel?.gps_ping_interval_minutes ?? 5}m
              </Text>
            </Pressable>
          </View>
          {mapCities.length > 0 ? (
            <ScrollChips
              value={cityFilter}
              options={[{ id: 'all', name: 'All cities' }, ...mapCities.map((c) => ({ id: c, name: c }))]}
              onChange={setCityFilter}
            />
          ) : null}
          <LocationMap
            latitude={center.latitude}
            longitude={center.longitude}
            height={260}
            zoom={markers.length > 3 ? 5 : markers.length > 1 ? 11 : 14}
            markers={markers}
            onMarkerPress={(id) =>
              router.push({
                pathname: '/(admin)/live-tracking/[employeeId]',
                params: { employeeId: id },
              })
            }
          />
          {markers.length === 0 ? (
            <Text style={styles.meta}>
              No one is sharing live location yet
              {cityFilter !== 'all' ? ' in this city' : ''}. World map shown until tracking starts.
            </Text>
          ) : null}
          <LiveLegend items={mapItems} />
        </View>
      ) : null}
    </View>
  );
}

function StatCard({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number | null | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.statCard} onPress={onPress}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
    </Pressable>
  );
}

function AttendancePie({
  present,
  onLeave,
  absent,
}: {
  present: number;
  onLeave: number;
  absent: number;
}) {
  const total = Math.max(present + onLeave + absent, 1);
  const slices = [
    { label: 'Present', value: present, color: '#16a34a' },
    { label: 'On leave', value: onLeave, color: '#eab308' },
    { label: 'Absent', value: absent, color: '#ef4444' },
  ];

  return (
    <View style={styles.pieWrap}>
      <View style={styles.barTrack}>
        {slices.map((s) =>
          s.value > 0 ? (
            <View
              key={s.label}
              style={{
                flex: s.value / total,
                backgroundColor: s.color,
                height: 12,
              }}
            />
          ) : null,
        )}
      </View>
      <Text style={styles.pieTotal}>{present + onLeave + absent} employees</Text>
      <View style={styles.legendCol}>
        {slices.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScrollChips({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipsRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.id}
          style={[styles.chip, value === opt.id && styles.chipActive]}
          onPress={() => onChange(opt.id)}>
          <Text style={[styles.chipText, value === opt.id && styles.chipTextActive]}>{opt.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function LiveLegend({ items }: { items: LiveEmployeeRow[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.liveList}>
      {items.slice(0, 6).map((item) => (
        <Pressable
          key={item.employee_id}
          style={styles.liveRow}
          onPress={() =>
            router.push({
              pathname: '/(admin)/live-tracking/[employeeId]',
              params: { employeeId: item.employee_id },
            })
          }>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: STATUS_COLOR[item.status ?? 'offline'] ?? STATUS_COLOR.offline },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.liveName}>{item.employee_name}</Text>
            <Text style={styles.liveSub} numberOfLines={1}>
              {[formatLiveStatus(item.status) || item.status, item.city, item.last_address]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  heading: { fontSize: 16, fontWeight: '800', color: Colors.heading },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  statLabel: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  statValue: { marginTop: 6, fontSize: 26, fontWeight: '800', color: Colors.heading },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  cardSub: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeChip: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rangeChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  rangeText: { fontSize: 12, fontWeight: '600', color: Colors.heading, textTransform: 'capitalize' },
  rangeTextActive: { color: '#fff' },
  dateBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 10,
    alignSelf: 'flex-start',
  },
  dateBtnText: { fontWeight: '700', color: Colors.heading },
  pieWrap: { gap: 10, marginTop: 4 },
  barTrack: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: Colors.borderLight,
  },
  pieTotal: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  legendCol: { gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, color: Colors.text, fontSize: 13 },
  legendValue: { fontWeight: '800', color: Colors.heading },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  chipTextActive: { color: '#fff' },
  liveList: { gap: 6 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  liveName: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  liveSub: { color: Colors.muted, fontSize: 11 },
});
