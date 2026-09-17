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
import { formatClock, hoursToLabel } from '@/lib/format';
import { displayYmd, ymd } from '@/lib/leaveUi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Audience = 'employee' | 'user';
type StatusFilter = 'all' | 'present' | 'absent' | 'leave';
type LocationFilter = 'all' | 'on' | 'off';

type AttendanceRow = {
  key: string;
  name: string;
  initials?: string;
  designation?: string | null;
  roles: string[];
  city?: string | null;
  accessSurface?: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number | null | undefined;
  status?: string | null;
  dailyStatus: string;
  onLocation: boolean;
  address?: string | null;
};

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
  const [audience, setAudience] = useState<Audience>('employee');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [employeeBoard, setEmployeeBoard] = useState<AttendanceDayBoard | null>(null);
  const [userBoard, setUserBoard] = useState<AttendanceDayBoard | null>(null);
  const [selfRows, setSelfRows] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (canViewAll) {
        const [sum, employees, users] = await Promise.all([
          getAttendanceDashboardSummary(day).catch(() => null),
          getAttendanceDayBoard(day, 'employee'),
          getAttendanceDayBoard(day, 'user'),
        ]);
        setSummary(sum);
        setEmployeeBoard(employees);
        setUserBoard(users);
        setSelfRows([]);
      } else {
        const history = await getMyHistory(90);
        const mine = history.items.filter((r) => r.date.slice(0, 10) === day);
        setSelfRows(mine);
        setEmployeeBoard(null);
        setUserBoard(null);
        setSummary({
          present: mine.length > 0 ? 1 : 0,
          on_leave: 0,
          absent: mine.length === 0 ? 1 : 0,
          total_users: 1,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setEmployeeBoard(null);
      setUserBoard(null);
      setSelfRows([]);
    } finally {
      setLoading(false);
    }
  }, [day, canViewAll, user?.name]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows: AttendanceRow[] = useMemo(() => {
    if (canViewAll) {
      const board = audience === 'employee' ? employeeBoard : userBoard;
      return (board?.items ?? []).map((item: AttendanceDayEntry) => ({
        key: item.employee_id,
        name: item.employee_name,
        initials: item.employee_initials,
        designation: item.designation,
        roles: item.roles,
        city: item.city,
        accessSurface: item.access_surface,
        clockIn: item.clock_in_time ?? null,
        clockOut: item.clock_out_time ?? null,
        hours: item.working_hours,
        status: item.status,
        dailyStatus: item.daily_status,
        onLocation: item.on_location,
        address: item.last_address,
      }));
    }
    return selfRows.map((r) => ({
      key: r.id,
      name: user?.name ?? 'You',
      initials: user?.name?.slice(0, 2).toUpperCase(),
      designation: user?.designation,
      roles: [],
      clockIn: r.clock_in_time ?? null,
      clockOut: r.clock_out_time,
      hours: r.working_hours,
      status: r.status,
      dailyStatus: 'present',
      onLocation: r.location_tracking_enabled && !r.clock_out_time,
    }));
  }, [audience, canViewAll, employeeBoard, selfRows, user, userBoard]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'all' || row.dailyStatus === statusFilter;
      const matchesLocation =
        locationFilter === 'all' ||
        (row.dailyStatus === 'present' &&
          (locationFilter === 'on' ? row.onLocation : !row.onLocation));
      const matchesRole = roleFilter === 'all' || row.roles.includes(roleFilter);
      return matchesStatus && matchesLocation && matchesRole;
    });
  }, [locationFilter, roleFilter, rows, statusFilter]);

  const roleOptions = useMemo(() => {
    const board = audience === 'employee' ? employeeBoard : userBoard;
    return Array.from(new Set((board?.items ?? []).flatMap((item) => item.roles))).sort();
  }, [audience, employeeBoard, userBoard]);

  const activeBoard = audience === 'employee' ? employeeBoard : userBoard;
  const metrics = {
    total: activeBoard?.items.length ?? (canViewAll ? 0 : 1),
    present: activeBoard?.items.filter((item) => item.daily_status === 'present').length ?? summary?.present ?? 0,
    absent: activeBoard?.items.filter((item) => item.daily_status === 'absent').length ?? summary?.absent ?? 0,
  };

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
          <Pressable style={[styles.stat, audience === 'employee' && statusFilter === 'all' && styles.statActive]} onPress={() => { setAudience('employee'); setStatusFilter('all'); }}>
            <Text style={styles.statValue}>{loading ? '--' : metrics.total}</Text>
            <Text style={styles.statLabel}>Total employees</Text>
          </Pressable>
          <Pressable style={[styles.stat, styles.statPresent, audience === 'employee' && statusFilter === 'present' && styles.statActive]} onPress={() => { setAudience('employee'); setStatusFilter('present'); }}>
            <Text style={[styles.statValue, styles.presentValue]}>{loading ? '--' : metrics.present}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </Pressable>
          <Pressable style={[styles.stat, styles.statAbsent, audience === 'employee' && statusFilter === 'absent' && styles.statActive]} onPress={() => { setAudience('employee'); setStatusFilter('absent'); }}>
            <Text style={[styles.statValue, styles.absentValue]}>{loading ? '--' : metrics.absent}</Text>
            <Text style={styles.statLabel}>Absent</Text>
          </Pressable>
          {canViewAll ? (
            <Pressable style={[styles.stat, audience === 'user' && styles.statActive]} onPress={() => { setAudience('user'); setStatusFilter('all'); setLocationFilter('all'); setRoleFilter('all'); }}>
              <Text style={styles.statValue}>{loading ? '--' : userBoard?.items.length ?? 0}</Text>
              <Text style={styles.statLabel}>Users</Text>
            </Pressable>
          ) : null}
        </View>

        {canViewAll ? (
          <View style={styles.audienceRow}>
            {(['employee', 'user'] as Audience[]).map((item) => (
              <Pressable key={item} onPress={() => { setAudience(item); setStatusFilter('all'); setLocationFilter('all'); setRoleFilter('all'); }} style={[styles.audienceButton, audience === item && styles.audienceButtonActive]}>
                <Ionicons name={item === 'employee' ? 'briefcase-outline' : 'people-outline'} size={16} color={audience === item ? Colors.brand : Colors.muted} />
                <Text style={[styles.audienceText, audience === item && styles.audienceTextActive]}>{item === 'employee' ? 'Employees' : 'Users'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.section}>{displayYmd(day)} · {audience === 'employee' ? 'Employee' : 'User'} attendance</Text>
            <Text style={styles.meta}>Daily attendance, access and location status</Text>
          </View>
          <Text style={styles.resultCount}>{filteredRows.length}</Text>
        </View>
        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.filters}>
          {(['all', 'present', 'absent', 'leave'] as StatusFilter[]).map((item) => (
            <FilterChip key={item} label={item === 'all' ? 'All status' : item === 'leave' ? 'On leave' : item[0].toUpperCase() + item.slice(1)} active={statusFilter === item} onPress={() => setStatusFilter(item)} />
          ))}
        </View>
        <Text style={styles.filterLabel}>Location</Text>
        <View style={styles.filters}>
          {(['all', 'on', 'off'] as LocationFilter[]).map((item) => (
            <FilterChip key={item} label={item === 'all' ? 'All locations' : item === 'on' ? 'On location' : 'Off location'} active={locationFilter === item} onPress={() => setLocationFilter(item)} />
          ))}
        </View>
        {roleOptions.length > 0 ? (
          <>
            <Text style={styles.filterLabel}>Role</Text>
            <View style={styles.filters}>
              <FilterChip label="All roles" active={roleFilter === 'all'} onPress={() => setRoleFilter('all')} />
              {roleOptions.map((role) => <FilterChip key={role} label={role.replace(/_/g, ' ')} active={roleFilter === role} onPress={() => setRoleFilter(role)} />)}
            </View>
          </>
        ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filteredRows.length === 0 ? (
          <Text style={styles.empty}>No {audience === 'employee' ? 'employees' : 'users'} match this filter.</Text>
        ) : (
          filteredRows.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.identity}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{row.initials ?? row.name.slice(0, 2).toUpperCase()}</Text></View>
                  <View style={styles.identityText}>
                    <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{row.roles.join(', ') || row.designation || '—'}</Text>
                  </View>
                </View>
                <Text style={[styles.statusBadge, row.dailyStatus === 'present' ? styles.badgePresent : row.dailyStatus === 'leave' ? styles.badgeLeave : styles.badgeAbsent]}>{row.dailyStatus}</Text>
              </View>
              <View style={styles.detailGrid}>
                <Detail label="City" value={row.city ?? '—'} />
                <Detail label="Access" value={row.accessSurface === 'both' ? 'Web & Mobile' : row.accessSurface ?? '—'} />
                <TimeCol label="In" value={formatClock(row.clockIn)} />
                <TimeCol label="Out" value={formatClock(row.clockOut)} />
                <Detail label="Hours" value={hoursToLabel(row.hours ?? null)} />
                <Detail label="Location" value={row.onLocation ? 'On' : 'Off'} valueStyle={row.onLocation ? styles.locationOn : undefined} />
              </View>
              {row.address ? <Text style={styles.address} numberOfLines={2}>{row.address}</Text> : null}
              <View style={styles.times}>
                <Text style={[styles.badge, row.onLocation ? styles.badgeOn : styles.badgeOff]}>{row.onLocation ? 'On location' : 'Off location'}</Text>
                {row.status ? <Text style={styles.badge}>{row.status.replace(/_/g, ' ')}</Text> : null}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Detail({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={[styles.timeValue, valueStyle]} numberOfLines={1}>{value}</Text>
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
  statActive: { borderColor: Colors.brand, backgroundColor: Colors.brandSoft },
  statPresent: { borderLeftColor: Colors.success },
  statAbsent: { borderLeftColor: Colors.danger },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  presentValue: { color: Colors.successText },
  absentValue: { color: Colors.dangerText },
  statLabel: { marginTop: 4, color: Colors.muted, fontSize: 12, fontWeight: '600' },
  audienceRow: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, padding: 4, borderWidth: 1, borderColor: Colors.border },
  audienceButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: Radius.sm, paddingVertical: 10 },
  audienceButtonActive: { backgroundColor: Colors.brandSoft },
  audienceText: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  audienceTextActive: { color: Colors.brand },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  section: { fontWeight: '800', color: Colors.heading, fontSize: 16 },
  resultCount: { minWidth: 28, textAlign: 'center', color: Colors.brand, backgroundColor: Colors.brandSoft, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontWeight: '800', fontSize: 12 },
  filterLabel: { color: Colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: -8 },
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
    borderColor: Colors.brand,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.muted },
  filterTextActive: { color: Colors.brand, fontWeight: '700' },
  meta: { color: Colors.muted },
  error: { color: Colors.danger },
  empty: { color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.xl },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.brandSoft },
  avatarText: { color: Colors.brand, fontWeight: '800', fontSize: 13 },
  identityText: { flex: 1, minWidth: 0 },
  name: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  sub: { color: Colors.muted, fontSize: 12 },
  statusBadge: { borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '800', textTransform: 'capitalize', overflow: 'hidden' },
  badgePresent: { color: Colors.successText, backgroundColor: Colors.successBg },
  badgeAbsent: { color: Colors.dangerText, backgroundColor: Colors.dangerBg },
  badgeLeave: { color: Colors.pendingText, backgroundColor: Colors.pendingBg },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detail: { width: '31%' },
  timeCol: { width: '31%' },
  timeLabel: { fontSize: 11, color: Colors.muted, fontWeight: '600' },
  timeValue: { marginTop: 2, fontWeight: '700', color: Colors.heading },
  locationOn: { color: Colors.successText },
  address: { color: Colors.muted, fontSize: 12 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
