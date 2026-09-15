import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTracking } from '@/context/TrackingContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  executeClockIn,
  executeClockOut,
  executeEndTracking,
  executeStartTracking,
  gateAttendanceLocation,
  type AttendanceActionFailure,
} from '@/lib/attendanceActions';
import { getMyVisits, getVisitHistory, type FieldVisit } from '@/lib/api/visits';
import { durationLabel, formatClock } from '@/lib/format';
import { ymd } from '@/lib/leaveUi';

type Props = {
  refreshKey?: number;
};

type BusyAction = 'clock-in' | 'clock-out' | 'start-tracking' | 'end-tracking' | null;

function isCompleted(visit: FieldVisit) {
  return visit.status.toLowerCase() === 'completed';
}

function visitAddress(visit: FieldVisit) {
  const formatted = (visit.dealer_address || '')
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  if (formatted) return formatted;
  return [visit.dealer_area, visit.dealer_city, visit.dealer_state].filter(Boolean).join(', ');
}

function visitStatusLabel(visit: FieldVisit) {
  return isCompleted(visit) ? 'Complete' : 'In Progress';
}

function currentHours(isClockedIn: boolean, clockInTime?: string | null, workingHours?: number | null) {
  if (!clockInTime) return '0.0';
  if (isClockedIn) {
    const started = new Date(clockInTime).getTime();
    return Math.max(0, (Date.now() - started) / 3_600_000).toFixed(1);
  }
  return (workingHours ?? 0).toFixed(1);
}

function handleActionFailure(error: AttendanceActionFailure, fallbackTitle: string) {
  if (error.kind === 'navigate') {
    router.push(error.href);
    return;
  }
  if (error.kind === 'already_clocked_in') {
    return;
  }
  Alert.alert(fallbackTitle, error.message);
}

export default function EmployeeDashboard({ refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const {
    today,
    isClockedIn,
    trackingActive,
    pingMinutes,
    refreshStatus,
  } = useTracking();
  const { canView, canCreate, showMyAttendanceLeave, isOrgAdmin } = usePermissions();
  const [visits, setVisits] = useState<FieldVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const busyRef = useRef(false);

  // Matrix: My Attendance & Leave → Create = clock in/out (+ apply leave elsewhere).
  const canUseClock = canCreate('my_attendance_leave');
  // Employee roles often have visit_history / attendance but not field_visits.
  const canUseMyVisitsApi = canView('field_visits') || canCreate('field_visits');
  const canUseHistoryApi = canView('visit_history');
  const canViewVisits =
    canUseMyVisitsApi || canUseHistoryApi || showMyAttendanceLeave;
  // Backend: POST /attendance/location/start|end requires user_tracking:read
  // (matrix: "Employee start & end location" View) — same as web canView('user_tracking').
  const canTrack = canView('user_tracking');

  const load = useCallback(async () => {
    setLoading(true);

    async function fetchVisits(): Promise<{ items: FieldVisit[]; total: number } | null> {
      const day = ymd(new Date());
      if (canUseMyVisitsApi) {
        return getMyVisits(day);
      }
      if (canUseHistoryApi && user?.id) {
        return getVisitHistory({
          employee_id: user.id,
          from_date: day,
          to_date: day,
          limit: 50,
        });
      }
      if (showMyAttendanceLeave) {
        return getMyVisits(day);
      }
      return null;
    }

    await Promise.all([
      canUseClock ? refreshStatus().catch(() => undefined) : Promise.resolve(),
      canViewVisits
        ? fetchVisits()
            .then((visitResponse) => setVisits(visitResponse?.items ?? []))
            .catch(() => setVisits([]))
        : Promise.resolve(),
    ]);
    setLoading(false);
  }, [
    canUseClock,
    canViewVisits,
    canUseMyVisitsApi,
    canUseHistoryApi,
    showMyAttendanceLeave,
    user?.id,
    refreshStatus,
  ]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load, refreshKey]),
  );

  const todayVisits = useMemo(
    () => [...visits].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [visits],
  );
  // Badge counts come only from today's loaded visits — never hardcoded.
  const assignedCount = todayVisits.length;
  const completedVisits = todayVisits.filter(isCompleted).length;
  const completion = assignedCount ? Math.round((completedVisits / assignedCount) * 100) : 0;

  const onDuty = isClockedIn;
  const clockTime = today?.record?.clock_in_time ? formatClock(today.record.clock_in_time) : null;

  async function withGate(next: string, action: BusyAction, run: () => Promise<void>) {
    if (busyRef.current) return;
    const block = await gateAttendanceLocation(next);
    if (block) {
      router.push(block as Href);
      return;
    }
    busyRef.current = true;
    setBusyAction(action);
    try {
      await run();
    } finally {
      busyRef.current = false;
      setBusyAction(null);
    }
  }

  async function onClockIn() {
    await withGate('/clock-in', 'clock-in', async () => {
      const result = await executeClockIn();
      if (!result.ok) {
        if (result.error.kind === 'already_clocked_in') {
          await load();
          await refreshStatus();
          return;
        }
        handleActionFailure(result.error, 'Clock In');
        return;
      }
      await load();
      await refreshStatus();
    });
  }

  async function onClockOut() {
    await withGate('/clock-out', 'clock-out', async () => {
      const result = await executeClockOut();
      if (!result.ok) {
        handleActionFailure(result.error, 'Clock Out');
        await load();
        return;
      }
      await refreshStatus();
      await load();
    });
  }

  async function onStartTracking() {
    if (!onDuty) {
      Alert.alert('Start Tracking', 'Clock in first, then start live tracking.');
      return;
    }
    await withGate('/start-tracking', 'start-tracking', async () => {
      const result = await executeStartTracking(pingMinutes);
      if (!result.ok) {
        await refreshStatus();
        await load();
        handleActionFailure(result.error, 'Start Tracking');
        return;
      }
      await refreshStatus();
      await load();
    });
  }

  async function onEndTracking() {
    await withGate('/start-tracking', 'end-tracking', async () => {
      const result = await executeEndTracking();
      if (!result.ok) {
        await load();
        handleActionFailure(result.error, 'End Tracking');
        return;
      }
      await refreshStatus();
      await load();
    });
  }

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
          <View style={styles.dutyActions}>
            <DutyActionButton
              label={onDuty ? 'Clock Out' : 'Clock In'}
              loading={busyAction === 'clock-in' || busyAction === 'clock-out'}
              disabled={busyAction !== null}
              onPress={() => {
                if (onDuty) void onClockOut();
                else void onClockIn();
              }}
            />
            {canTrack ? (
              <DutyActionButton
                label={trackingActive ? 'End Tracking' : 'Start Tracking'}
                loading={busyAction === 'start-tracking' || busyAction === 'end-tracking'}
                disabled={busyAction !== null || !onDuty}
                secondary
                onPress={() => {
                  if (trackingActive) void onEndTracking();
                  else void onStartTracking();
                }}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {canViewVisits ? (
        <View style={styles.statGrid}>
          <Stat label="VISITS" value={`${completedVisits} / ${assignedCount}`} />
          <Stat label="TARGET" value={`${completion}%`} />
          <Stat label="HOURS" value={`${currentHours(onDuty, today?.record?.clock_in_time, today?.record?.working_hours)}h`} />
        </View>
      ) : null}

      {canViewVisits ? (
        <View style={styles.todayCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Visits</Text>
            <View style={styles.assignedBadge}>
              <Text style={styles.assignedBadgeText}>
                {completedVisits} of {assignedCount} assigned
              </Text>
            </View>
          </View>
          {loading ? (
            <Text style={styles.emptyText}>Loading your visits...</Text>
          ) : todayVisits.length ? (
            <View style={styles.visitList}>
              {todayVisits.map((visit) => {
                const done = isCompleted(visit);
                const statusLabel = visitStatusLabel(visit);
                const address = visitAddress(visit) || visit.dealer_name || 'Address pending';
                return (
                  <Pressable
                    key={visit.id}
                    style={styles.todayVisitRow}
                    onPress={() =>
                      router.push({
                        pathname: '/visit-detail',
                        params: {
                          visitId: visit.id,
                          dealerName: visit.dealer_name ?? 'Dealer',
                          checkedIn: visit.reached_at ? '1' : '0',
                          reachedAt: visit.reached_at ?? '',
                        },
                      })
                    }>
                    <View
                      style={[
                        styles.statusDot,
                        done ? styles.statusDotComplete : styles.statusDotProgress,
                      ]}
                    />
                    <View style={styles.visitInfo}>
                      <View style={styles.todayVisitHead}>
                        <Text style={styles.visitName} numberOfLines={2}>
                          {address}
                        </Text>
                        <Text
                          style={[
                            styles.statusLabel,
                            done ? styles.statusComplete : styles.statusProgress,
                          ]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>No visits assigned for today.</Text>
          )}
          <Pressable accessibilityRole="button" onPress={() => router.push('/(app)/visits')}>
            <Text style={styles.link}>See all visits</Text>
          </Pressable>
        </View>
      ) : null}

      {(!isOrgAdmin || canViewVisits) ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
            <Text style={styles.sectionHint}>Start with one tap</Text>
          </View>
          <View style={styles.actions}>
            {canViewVisits ? (
              <QuickAction icon="location-outline" label="Next visit" onPress={() => router.push('/(app)/visits')} />
            ) : null}
            {canUseClock ? (
              <QuickAction icon="calendar-outline" label="Apply leave" onPress={() => router.push('/apply-leave')} />
            ) : null}
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

function DutyActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.clockButton,
        secondary && styles.clockButtonSecondary,
        (disabled || loading) && styles.clockButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}>
      {loading ? (
        <ActivityIndicator color={secondary ? '#BCE9E4' : Colors.brand} />
      ) : (
        <Text style={[styles.clockButtonText, secondary && styles.clockButtonTextSecondary]}>{label}</Text>
      )}
    </Pressable>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.action, (disabled || loading) && styles.actionDisabled]}
      onPress={onPress}
      disabled={disabled || loading}>
      <View style={styles.actionIcon}>
        {loading ? (
          <ActivityIndicator size="small" color="#008C87" />
        ) : (
          <Ionicons name={icon} size={20} color="#008C87" />
        )}
      </View>
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
  dutyActions: { flexDirection: 'row', gap: 8 },
  clockButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#7ACDC1',
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  clockButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7ACDC1',
  },
  clockButtonDisabled: { opacity: 0.45 },
  clockButtonText: { color: Colors.brand, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  clockButtonTextSecondary: { color: '#BCE9E4' },
  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minHeight: 74, backgroundColor: '#FFFFFF', borderRadius: Radius.md, borderWidth: 1, borderColor: '#D7E8E8', padding: 12, justifyContent: 'space-between' },
  statLabel: { color: '#9AAEAF', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  statValue: { color: Colors.brand, fontSize: 18, fontWeight: '800' },
  section: { gap: 10 },
  todayCard: {
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#D7E8E8',
    padding: Spacing.md,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: Colors.brand, fontSize: 15, fontWeight: '800' },
  assignedBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  assignedBadgeText: { color: '#1D4ED8', fontSize: 11, fontWeight: '700' },
  link: { color: '#008C87', fontSize: 14, fontWeight: '600' },
  sectionHint: { color: '#98A9AA', fontSize: 10 },
  visitList: { gap: 8 },
  todayVisitRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  statusDotProgress: { backgroundColor: '#2563EB' },
  statusDotComplete: { backgroundColor: '#16A34A' },
  visitInfo: { flex: 1, gap: 3 },
  todayVisitHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  visitName: { flex: 1, color: '#31545A', fontSize: 13, fontWeight: '800' },
  visitAddress: { color: '#809294', fontSize: 11 },
  statusLabel: { fontSize: 11, fontWeight: '700' },
  statusProgress: { color: '#1D4ED8' },
  statusComplete: { color: '#15803D' },
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
  actionDisabled: { opacity: 0.6 },
  actionIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#E2F4F0', alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#4F7173', fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
