import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireEmployeeTab from '@/components/RequireEmployeeTab';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getMyHistory,
  getTodayStatus,
  type AttendanceRecord,
  type TodayStatus,
} from '@/lib/api/attendance';
import { getLeaveBalance, getMyLeaveRequests, type LeaveRequest } from '@/lib/api/leave';
import {
  listLeaveRequestsAdmin,
  type LeaveRequestAdmin,
} from '@/lib/api/leaveAdmin';
import { getFieldOperationsSettings } from '@/lib/api/org';
import { employeeCode, formatClock, formatDate } from '@/lib/format';
import { displayYmdRange, leaveStatusMeta, ymd } from '@/lib/leaveUi';
import { routeForLocationAction } from '@/lib/locationGate';
import { isFieldTrackingEnabled } from '@/lib/permissions';
import { canAccessLeaveManagement } from '@/lib/tabNavigation';
import { getMissedClockOut, saveMissedClockOut } from '@/lib/visits';

export default function ClockScreen() {
  return (
    <RequireEmployeeTab tab="clock">
      <ClockContent />
    </RequireEmployeeTab>
  );
}

function ClockContent() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isOrgAdmin, showMyAttendanceLeave, hasAnyAdminRead, has, canView, canCreate } =
    usePermissions();
  const permCtx = {
    isOrgAdmin,
    showMyAttendanceLeave,
    hasAnyAdminRead,
    has,
    canView,
    fieldTrackingEnabled: isFieldTrackingEnabled(user?.organization?.enabled_modules),
  };
  const showLeaveManagement = canAccessLeaveManagement(permCtx);
  const [today, setToday] = useState<TodayStatus | null>(null);
  const [leaveDays, setLeaveDays] = useState(0);
  const [requests, setRequests] = useState<
    Array<{
      id: string;
      title: string;
      dates: string;
      status: string;
    }>
  >([]);
  const [missedOpen, setMissedOpen] = useState(false);
  const [settings, setSettings] = useState<Awaited<
    ReturnType<typeof getFieldOperationsSettings>
  > | null>(null);

  const canTrack =
    canCreate('user_tracking') ||
    has('live_location', 'create') ||
    has('live_location', 'track');

  const load = useCallback(async () => {
    if (!user) return;
    if (isOrgAdmin) {
      setToday(null);
      setMissedOpen(false);
      const adminReqs = await listLeaveRequestsAdmin().catch(() => ({ items: [] as LeaveRequestAdmin[] }));
      setRequests(
        (adminReqs.items ?? []).slice(0, 5).map((item) => ({
          id: item.id,
          title: [item.employee_name, item.leave_type_name ?? 'Leave'].filter(Boolean).join(' · '),
          dates: displayYmdRange(
            item.from_date || item.start_date || ymd(new Date()),
            item.to_date || item.end_date || item.from_date || item.start_date || ymd(new Date()),
          ),
          status: item.status,
        })),
      );
      return;
    }
    const status = await getTodayStatus().catch(() => null);
    setToday(status);
    const orgSettings = await getFieldOperationsSettings().catch(() => null);
    setSettings(orgSettings);
    const balance = await getLeaveBalance().catch(() => null);
    setLeaveDays(balance?.items.reduce((sum, item) => sum + (item.balance || 0), 0) ?? 0);
    const mine = await getMyLeaveRequests().catch(() => [] as LeaveRequest[]);
    setRequests(
      mine.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.leave_type_name ?? 'Leave',
        dates: displayYmdRange(item.from_date, item.to_date),
        status: item.status,
      })),
    );

    const existing = await getMissedClockOut();
    if (existing?.dismissed) {
      setMissedOpen(false);
    } else if (existing) {
      setMissedOpen(true);
    } else {
      const records = await getMyHistory(30).catch(() => null);
      const autoClosed = records?.items.find((item) => {
        if (!item.clock_out_time) return false;
        const hour = new Date(item.clock_out_time).getHours();
        return hour >= 21 || item.status === 'auto_closed';
      });
      if (autoClosed) {
        await saveMissedClockOut({
          id: autoClosed.id,
          date: String(autoClosed.date),
          expectedOut: orgSettings?.shift_end_time
            ? formatClock(new Date(`1970-01-01T${orgSettings.shift_end_time}:00`).toISOString())
            : '06:00 PM',
          autoOut: formatClock(autoClosed.clock_out_time),
          status: 'FLAGGED_REVIEW',
        });
        setMissedOpen(true);
      } else {
        setMissedOpen(false);
      }
    }
  }, [user, isOrgAdmin]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDuty = Boolean(today?.is_clocked_in);
  const record: AttendanceRecord | null = today?.record ?? null;
  const trackingActive = Boolean(today?.tracking_active);
  const shiftLabel =
    settings?.shift_start_time && settings?.shift_end_time
      ? `${formatClock(new Date(`1970-01-01T${settings.shift_start_time}:00`).toISOString())}–${formatClock(new Date(`1970-01-01T${settings.shift_end_time}:00`).toISOString())}`
      : 'Shift settings unavailable';

  async function goWithLocation(next: '/clock-in' | '/clock-out' | '/start-tracking') {
    const block = await routeForLocationAction(next);
    router.push(block ?? next);
  }

  async function onOpenTracking() {
    if (!onDuty) return;
    await goWithLocation('/start-tracking');
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.screenTitle}>
        {isOrgAdmin ? 'Leave & Attendance' : 'Clock & My Leave'}
      </Text>

      {!isOrgAdmin && onDuty ? (
        <View style={[styles.tracking, !trackingActive && styles.trackingMuted]}>
          <Ionicons
            name={trackingActive ? 'navigate' : 'time-outline'}
            size={14}
            color={trackingActive ? Colors.trackingText : Colors.muted}
          />
          <Text style={[styles.trackingText, !trackingActive && styles.trackingTextMuted]}>
            {trackingActive ? 'TRACKING ACTIVE' : 'ATTENDANCE MARKED · TRACKING OFF'}
          </Text>
        </View>
      ) : null}

      {!isOrgAdmin ? (
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusDotWrap}>
            <View style={[styles.statusDot, onDuty ? styles.dotOn : styles.dotIdle]} />
            <Text style={styles.statusLabel}>Status: {onDuty ? 'On Duty' : 'Idle'}</Text>
          </View>
          <Text style={styles.empId}>{employeeCode(user?.id ?? '')}</Text>
        </View>

        {onDuty && record ? (
          <>
            <Text style={styles.metricLabel}>Clocked in since</Text>
            <Text style={styles.metricValueLg}>{formatClock(record.clock_in_time)}</Text>
            <Text style={styles.hint}>
              {trackingActive
                ? 'Live location is active. Open End Tracking to stop, or Clock Out when done.'
                : 'Attendance is already marked. Open Start Tracking to open the map and begin live location.'}
            </Text>
            {canTrack ? (
              <View style={styles.actionRow}>
                <PrimaryButton
                  label={trackingActive ? 'Open End Tracking' : 'Open Start Tracking'}
                  onPress={() => void onOpenTracking()}
                />
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => void goWithLocation('/clock-out')}>
                  <Text style={styles.secondaryButtonText}>Clock Out</Text>
                </Pressable>
              </View>
            ) : (
              <PrimaryButton label="Clock Out" onPress={() => void goWithLocation('/clock-out')} />
            )}
          </>
        ) : (
          <>
            <Text style={styles.shiftLabel}>Shift schedule for today</Text>
            <Text style={styles.shiftValue}>
              {formatDate(new Date())} · {shiftLabel}
            </Text>
            <PrimaryButton label="Clock In" onPress={() => void goWithLocation('/clock-in')} />
            {canTrack ? (
              <>
                <PrimaryButton
                  label="Open Start Tracking"
                  onPress={() => undefined}
                  disabled
                />
                <Text style={styles.hint}>
                  Clock in marks attendance only. After clock-in, Open Start Tracking becomes
                  available for live location.
                </Text>
              </>
            ) : null}
          </>
        )}
      </View>
      ) : null}

      {!isOrgAdmin && missedOpen ? (
        <Pressable style={styles.missed} onPress={() => router.push('/missed-clock-out')}>
          <Ionicons name="warning" size={18} color={Colors.pendingText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.missedTitle}>Missed clock-out</Text>
            <Text style={styles.missedCopy}>Tap to review your last auto-closed shift.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
      ) : null}

      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickCard}
          onPress={() =>
            router.push(isOrgAdmin ? '/(admin)/attendance' : '/(app)/calendar')
          }>
          <Ionicons name="calendar-outline" size={22} color={Colors.brand} />
          <Text style={styles.quickLabel}>{isOrgAdmin ? 'Attendance' : 'My attendance calendar'}</Text>
        </Pressable>
        <Pressable
          style={styles.quickCard}
          onPress={() =>
            router.push(isOrgAdmin ? '/(admin)/leave/balances' : '/leave-balance')
          }>
          <Ionicons name="wallet-outline" size={22} color={Colors.brand} />
          <Text style={styles.quickLabel}>
            {isOrgAdmin ? 'Leave balance' : `Leave balance · ${leaveDays}d`}
          </Text>
        </Pressable>
      </View>

      {showLeaveManagement ? (
        <Pressable style={styles.mgmtCard} onPress={() => router.push('/leave-management')}>
          <View style={styles.mgmtIcon}>
            <Ionicons name="document-text-outline" size={22} color={Colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mgmtTitle}>Leave management</Text>
            <Text style={styles.mgmtCopy}>Types, requests, team calendar & attendance</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </Pressable>
      ) : null}

      {!isOrgAdmin ? (
        <Pressable style={styles.applyBtn} onPress={() => router.push('/apply-leave')}>
          <Text style={styles.applyText}>+ Apply for leave</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => {
          if (isOrgAdmin) router.push('/(admin)/leave/requests');
        }}>
        <Text style={styles.sectionTitle}>
          {isOrgAdmin ? 'Leave requests' : 'My recent leave requests'}
        </Text>
      </Pressable>
      {requests.length === 0 ? (
        <Text style={styles.meta}>No leave requests yet.</Text>
      ) : (
        requests.map((item) => {
          const meta = leaveStatusMeta(item.status);
          return (
            <Pressable
              key={item.id}
              style={styles.leaveRow}
              onPress={() => {
                if (isOrgAdmin) router.push('/(admin)/leave/requests');
              }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.leaveName}>{item.title}</Text>
                <Text style={styles.leaveDates}>{item.dates}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, paddingBottom: 40, gap: Spacing.md },
  screenTitle: { fontSize: 24, fontWeight: '800', color: Colors.heading },
  tracking: {
    backgroundColor: Colors.trackingBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  trackingMuted: { backgroundColor: Colors.borderLight },
  trackingText: { color: Colors.trackingText, fontSize: 11, fontWeight: '800' },
  trackingTextMuted: { color: Colors.muted },
  card: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 10,
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotIdle: { backgroundColor: Colors.muted },
  dotOn: { backgroundColor: Colors.success },
  statusLabel: { color: Colors.muted, fontSize: 13 },
  empId: { color: Colors.muted, fontSize: 12, fontWeight: '600' },
  shiftLabel: { color: Colors.muted, fontSize: 13 },
  shiftValue: { color: Colors.heading, fontSize: 16, fontWeight: '700' },
  metricLabel: { color: Colors.muted, fontSize: 12 },
  metricValueLg: { fontSize: 28, fontWeight: '800', color: Colors.heading },
  actionRow: { gap: 10 },
  secondaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { color: Colors.heading, fontSize: 16, fontWeight: '700' },
  missed: {
    backgroundColor: Colors.pendingBg,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  missedTitle: { fontWeight: '800', color: Colors.heading },
  missedCopy: { color: Colors.text, fontSize: 12, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 8,
    alignItems: 'flex-start',
  },
  quickLabel: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  mgmtCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mgmtIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mgmtTitle: { fontWeight: '800', color: Colors.heading, fontSize: 15 },
  mgmtCopy: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  applyBtn: {
    backgroundColor: Colors.brandSoft,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
  },
  applyText: { color: Colors.brand, fontWeight: '800' },
  hint: { color: Colors.muted, fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.heading, marginTop: 4 },
  meta: { color: Colors.muted },
  leaveRow: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  leaveName: { fontWeight: '700', color: Colors.heading },
  leaveDates: { color: Colors.muted, fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
