import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { DateField } from '@/components/ui/DateField';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  createLeaveRequest,
  getLeaveBalance,
  getLeaveWorkingDays,
  getMyLeaveRequests,
  listLeaveTypesForMe,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
} from '@/lib/api/leave';
import {
  DEFAULT_WORKING_DAYS,
  computeWorkingDaysBetween,
  dateInLeaveRanges,
  isWorkingDayIso,
  parseYmd,
  ymd,
} from '@/lib/leaveUi';

export default function ApplyLeaveScreen() {
  const bottomInset = useContentBottomInset();
  const today = ymd(new Date());
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([...DEFAULT_WORKING_DAYS]);
  const [typeId, setTypeId] = useState('');
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void Promise.all([
      listLeaveTypesForMe()
        .then((items) => {
          const active = items.filter(
            (item) => item.is_active ?? (item.status === 'active' || item.status == null),
          );
          setTypes(active);
          if (active[0]) setTypeId(active[0].id);
        })
        .catch(() => setTypes([])),
      getLeaveBalance()
        .then((res) => setBalances(res.items ?? []))
        .catch(() => setBalances([])),
      getMyLeaveRequests()
        .then((rows) => setRequests(Array.isArray(rows) ? rows : []))
        .catch(() => setRequests([])),
      getLeaveWorkingDays()
        .then((res) =>
          setWorkingDays(
            res.working_days?.length ? res.working_days : [...DEFAULT_WORKING_DAYS],
          ),
        )
        .catch(() => setWorkingDays([...DEFAULT_WORKING_DAYS])),
    ]);
  }, []);

  const selected = types.find((item) => item.id === typeId);
  const selectedBalance = balances.find((b) => b.leave_type_id === typeId);
  const blockedRanges = useMemo(
    () =>
      requests
        .filter((row) => row.status === 'pending' || row.status === 'approved')
        .map((row) => ({ from_date: row.from_date, to_date: row.to_date })),
    [requests],
  );
  const requestedDays = useMemo(
    () => (fromDate && toDate ? computeWorkingDaysBetween(fromDate, toDate, workingDays) : 0),
    [fromDate, toDate, workingDays],
  );
  const isLimited = selectedBalance?.allocation_mode !== 'unlimited';
  const balanceExceeded =
    Boolean(selectedBalance) && isLimited && requestedDays > selectedBalance!.balance;
  const maxConsecutive = selected?.max_consecutive_days ?? null;

  function setFrom(value: string) {
    setFromDate(value);
    if (parseYmd(value) > parseYmd(toDate)) setToDate(value);
  }

  function rangeOverlapsBlocked(from: string, to: string) {
    const start = parseYmd(from);
    const end = parseYmd(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return true;
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = ymd(cursor);
      if (dateInLeaveRanges(iso, blockedRanges)) return true;
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  }

  async function onSubmit() {
    if (!typeId) {
      Alert.alert('Leave', 'No leave types are configured for your organization.');
      return;
    }
    if (!reason.trim()) {
      Alert.alert('Leave', 'Enter a brief reason for leave.');
      return;
    }
    if (fromDate < today) {
      Alert.alert('Leave', 'Past dates cannot be selected for leave.');
      return;
    }
    if (requestedDays <= 0) {
      Alert.alert('Leave', 'Select a range that includes at least one working day.');
      return;
    }
    if (!isWorkingDayIso(fromDate, workingDays) || !isWorkingDayIso(toDate, workingDays)) {
      Alert.alert('Leave', 'From and to dates must fall on working days.');
      return;
    }
    if (rangeOverlapsBlocked(fromDate, toDate)) {
      Alert.alert('Leave', 'Selected dates overlap an existing pending or approved request.');
      return;
    }
    if (maxConsecutive != null && requestedDays > maxConsecutive) {
      Alert.alert(
        'Leave',
        `This leave type allows at most ${maxConsecutive} consecutive working day(s).`,
      );
      return;
    }
    if (balanceExceeded) {
      Alert.alert(
        'Leave',
        `You can apply for only ${selectedBalance?.balance ?? 0} more day(s) of this leave type.`,
      );
      return;
    }

    setLoading(true);
    try {
      const created = await createLeaveRequest({
        leave_type_id: typeId,
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
      });
      router.replace({
        pathname: '/leave-applied',
        params: {
          id: created.id,
          type: created.leave_type_name,
          from: created.from_date,
          to: created.to_date,
          days: String(created.number_of_days),
          status: created.status,
          createdAt: created.created_at,
        },
      });
    } catch (err) {
      Alert.alert('Leave', err instanceof Error ? err.message : 'Could not apply.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireModuleAccess module="my_attendance_leave" allowCreate>
      <SafeScreen>
        <ScreenHeader title="Apply Leave" onBack={() => router.back()} />
        <KeyboardSafeScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomInset }]}>
          <Text style={styles.label}>Leave Type</Text>
          <Pressable style={styles.select} onPress={() => setOpen((v) => !v)}>
            <Text style={styles.selectText}>{selected?.name || 'Select leave type'}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.muted} />
          </Pressable>
          {open
            ? types.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.option}
                  onPress={() => {
                    setTypeId(item.id);
                    setOpen(false);
                  }}>
                  <Text style={styles.optionText}>{item.name}</Text>
                </Pressable>
              ))
            : null}
          {open && types.length === 0 ? (
            <Text style={styles.empty}>No leave types are available yet.</Text>
          ) : null}

          {selectedBalance ? (
            <Text style={styles.balance}>
              Remaining balance: {selectedBalance.balance} day(s)
            </Text>
          ) : null}

          <DateField
            label="From Date"
            value={fromDate}
            onChange={setFrom}
            minimumDate={parseYmd(today)}
          />
          <DateField
            label="To Date"
            value={toDate}
            onChange={setToDate}
            minimumDate={parseYmd(fromDate)}
          />

          <View style={styles.duration}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.days}>
              Selected: {requestedDays} working day{requestedDays === 1 ? '' : 's'}
            </Text>
          </View>

          <Text style={styles.label}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Brief reason for leave..."
            placeholderTextColor={Colors.muted}
            multiline
            style={styles.area}
          />

          <View style={styles.info}>
            <Ionicons name="information-circle" size={18} color={Colors.infoText} />
            <Text style={styles.infoText}>Your manager will be notified once submitted.</Text>
          </View>

          <PrimaryButton label="Apply Leave" loading={loading} onPress={() => void onSubmit()} />
          <OutlineButton label="Cancel" onPress={() => router.back()} />
        </KeyboardSafeScrollView>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { padding: Spacing.md, gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  balance: { fontSize: 13, fontWeight: '600', color: Colors.muted },
  empty: { fontSize: 13, color: Colors.muted, paddingVertical: 4 },
  select: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 16, fontWeight: '600', color: Colors.heading },
  option: { paddingVertical: 12, paddingHorizontal: 8 },
  optionText: { fontWeight: '600', color: Colors.heading },
  duration: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  days: { fontWeight: '800', color: Colors.heading },
  area: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: Colors.background,
    color: Colors.heading,
  },
  info: {
    backgroundColor: Colors.infoBg,
    borderRadius: Radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, color: Colors.infoText, fontSize: 13 },
});
