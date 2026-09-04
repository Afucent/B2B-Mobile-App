import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { getTodayStatus, type TodayStatus } from '@/lib/api/attendance';
import { getMyVisits, type FieldVisit } from '@/lib/api/visits';
import { durationLabel, firstName, formatClock, greetingForNow, initials } from '@/lib/format';

type Props = {
  refreshKey?: number;
};

function isCompleted(visit: FieldVisit) {
  return visit.status.toLowerCase() === 'completed';
}

function visitAddress(visit: FieldVisit) {
  return [visit.dealer_area, visit.dealer_city, visit.dealer_state].filter(Boolean).join(', ');
}

function currentHours(status: TodayStatus | null) {
  const record = status?.record;
  if (!record) return '0.0';
  if (status?.is_clocked_in) {
    const started = new Date(record.clock_in_time).getTime();
    return Math.max(0, (Date.now() - started) / 3_600_000).toFixed(1);
  }
  return (record.working_hours ?? 0).toFixed(1);
}

export default function EmployeeDashboard({ refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const { has, canView, showMyAttendanceLeave } = usePermissions();
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [visitsTotal, setVisitsTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const canUseClock =
    showMyAttendanceLeave ||
    has('attendance', 'create') ||
    has('attendance', 'clock') ||
    has('my_attendance_leave', 'create');
  const canViewVisits = canView('field_visits');

  const load = useCallback(async () => {
    setLoading(true);
    const [attendance, visitResponse] = await Promise.all([
      canUseClock ? getTodayStatus().catch(() => null) : Promise.resolve(null),
      canViewVisits ? getMyVisits().catch(() => null) : Promise.resolve(null),
    ]);

    setToday(attendance);
    setVisits(visitResponse?.items ?? []);
    setVisitsTotal(visitResponse?.total ?? 0);
    setLoading(false);
  }, [canUseClock, canViewVisits]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshKey]),
  );

  const pendingVisits = useMemo(
    () => visits.filter((visit) => !isCompleted(visit)).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [visits],
  );
  const completedVisits = visits.filter(isCompleted).length;
  const completion = visitsTotal ? Math.round((completedVisits / visitsTotal) * 100) : 0;
  const name = user?.name ?? 'there';

  const onDuty = Boolean(today?.is_clocked_in);
  const clockTime = today?.record?.clock_in_time ? formatClock(today.record.clock_in_time) : null;

  return (
    <View style={styles.wrap}>
      {/* <View style={styles.topRow}>
        <View>
          <Text style={styles.logo}>afbex</Text>
          <Text style={styles.workspace}>FIELD WORKSPACE</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={21} color="#D7E8E8" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Profile" onPress={() => router.push('/(app)/profile')}>
            {user?.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{initials(name)}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View> */}

 
      {canUseClock ? (
        <View style={styles.dutyCard}>
          <View style={styles.dutyHeader}>
            <View>
              <Text style={styles.dutyEyebrow}>{onDuty ? 'ON THE FIELD' : 'READY FOR THE FIELD'}</Text>
              <Text style={styles.dutyTime}>{onDuty && clockTime ? clockTime : 'Start your day'}</Text>
              <Text style={styles.dutyCopy}>
                {onDuty && today?.record ? `${durationLabel(today.record.clock_in_time)} on duty` : 'Clock in to start your day'}
              </Text>
            </View>
            <View style={styles.clockIcon}>
              <Ionicons name="time-outline" size={23} color="#BCE9E4" />
            </View>
          </View>
          <Pressable style={styles.clockButton} onPress={() => router.push('/(app)/clock')}>
            <Text style={styles.clockButtonText}>{onDuty ? 'Manage attendance' : 'Clock in'}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.brand} />
          </Pressable>
        </View>
      ) : null}

      {canViewVisits ? (
        <View style={styles.statGrid}>
          <Stat label="VISITS" value={`${completedVisits} / ${visitsTotal}`} />
          <Stat label="TARGET" value={`${completion}%`} />
          <Stat label="HOURS" value={`${currentHours(today)}h`} />
        </View>
      ) : null}

      {canViewVisits ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next on your route</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/field')}>
              <Text style={styles.link}>See route</Text>
            </Pressable>
          </View>
          {loading ? (
            <Text style={styles.emptyText}>Loading your visits...</Text>
          ) : pendingVisits.length ? (
            <View style={styles.visitList}>
              {pendingVisits.slice(0, 2).map((visit, index) => (
                <Pressable key={visit.id} style={[styles.visitRow, index === 0 && styles.nextVisit]} onPress={() => router.push('/(app)/field')}>
                  <View style={[styles.visitIcon, index === 0 && styles.visitIconActive]}>
                    <Ionicons name="location-outline" size={20} color={index === 0 ? '#FFFFFF' : Colors.brandDark} />
                  </View>
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitName} numberOfLines={1}>{visit.dealer_name ?? 'Scheduled visit'}</Text>
                    <Text style={styles.visitAddress} numberOfLines={1}>{visitAddress(visit) || visit.dealer_address || 'Address pending'}</Text>
                  </View>
                  <View style={styles.visitMeta}>
                    <Text style={[styles.visitTime, index === 0 && styles.visitTimeActive]}>{formatClock(visit.scheduled_at)}</Text>
                    <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No visits assigned for today.</Text>
          )}
        </View>
      ) : null}

      {(canUseClock || canViewVisits) ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Text style={styles.sectionHint}>Start with one tap</Text>
          </View>
          <View style={styles.actions}>
            {canUseClock ? <QuickAction icon="time-outline" label={onDuty ? 'Clock / out' : 'Clock in'} onPress={() => router.push('/(app)/clock')} /> : null}
            {canViewVisits ? <QuickAction icon="location-outline" label="Next visit" onPress={() => router.push('/(app)/visits')} /> : null}
            {/* {canViewVisits ? <QuickAction icon="map-outline" label="Route" onPress={() => router.push('/visit-map')} /> : null}
            {canViewVisits ? <QuickAction icon="document-outline" label="Task" onPress={() => router.push('/assignment')} /> : null} */}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={20} color="#008C87" /></View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  topRow: { backgroundColor: Colors.brand, marginHorizontal: -Spacing.md, marginTop: -Spacing.md, paddingHorizontal: Spacing.md + 4, paddingTop: 18, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0 },
  workspace: { color: '#AFC8C8', fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginTop: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E4F4F1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.brand, fontSize: 10, fontWeight: '800' },
  dutyCard: { backgroundColor: Colors.brand, borderRadius: Radius.lg, padding: Spacing.md, gap: 16 },
  dutyHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  dutyEyebrow: { color: '#8FC6C1', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  dutyTime: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 8 },
  dutyCopy: { color: '#BBD0D0', fontSize: 12, marginTop: 4 },
  clockIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#2A5961', alignItems: 'center', justifyContent: 'center' },
  clockButton: { minHeight: 46, backgroundColor: '#7ACDC1', borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  clockButtonText: { color: Colors.brand, fontSize: 15, fontWeight: '700' },
  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minHeight: 74, backgroundColor: '#FFFFFF', borderRadius: Radius.md, borderWidth: 1, borderColor: '#D7E8E8', padding: 12, justifyContent: 'space-between' },
  statLabel: { color: '#9AAEAF', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  statValue: { color: Colors.brand, fontSize: 18, fontWeight: '800' },
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: Colors.brand, fontSize: 15, fontWeight: '800' },
  link: { color: '#008C87', fontSize: 14, fontWeight: '600' },
  sectionHint: { color: '#98A9AA', fontSize: 10 },
  visitList: { gap: 8 },
  visitRow: { minHeight: 60, borderRadius: Radius.md, borderWidth: 1, borderColor: '#D7E8E8', backgroundColor: '#FFFFFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  nextVisit: { backgroundColor: '#E2F4F0', borderColor: '#A6DCD4' },
  visitIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#ECF5F3', alignItems: 'center', justifyContent: 'center' },
  visitIconActive: { backgroundColor: Colors.brand },
  visitInfo: { flex: 1, gap: 3 },
  visitName: { color: '#31545A', fontSize: 12, fontWeight: '800' },
  visitAddress: { color: '#809294', fontSize: 10 },
  visitMeta: { alignItems: 'flex-end', gap: 4 },
  visitTime: { color: '#7D9092', fontSize: 9, fontWeight: '700' },
  visitTimeActive: { color: '#008C87' },
  emptyText: { color: Colors.muted, fontSize: 13, paddingVertical: 8 },
actions: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
action: {
  width: '48%',
  minHeight: 54,
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#D7E8E8',
  borderRadius: Radius.md,
  paddingHorizontal: 10,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 9,
},
  actionIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E2F4F0', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#4F7173', fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
