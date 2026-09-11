import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { DateField } from '@/components/ui/DateField';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill, statusTone } from '@/components/ui/StatusPill';
import { TextField } from '@/components/ui/TextField';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getLeaveWorkingDays } from '@/lib/api/leave';
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  extendLeaveRequest,
  listActiveLeaveTypes,
  listLeaveRequestsAdmin,
  listOrgLeaveBalances,
  rejectLeaveRequest,
  type LeaveRequestAdmin,
  type LeaveTypeAdmin,
  type OrgLeaveBalanceRow,
} from '@/lib/api/leaveAdmin';
import { listUsers, type AdminUser } from '@/lib/api/users';
import {
  DEFAULT_WORKING_DAYS,
  cancelLeaveBreakdown,
  computeWorkingDaysBetween,
  dateInLeaveRanges,
  displayYmdRange,
  isWorkingDayIso,
  parseYmd,
  ymd,
} from '@/lib/leaveUi';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'cancelled', label: 'Cancelled' },
] as const;

function addDaysYmd(iso: string, days: number) {
  const d = parseYmd(iso);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export default function AdminLeaveRequestsScreen() {
  const bottomInset = useContentBottomInset();
  const { canEdit, canApprove, canCreate } = usePermissions();
  const canDecide =
    canEdit('leave_requests') || canApprove('leave') || canApprove('leave_requests');
  const canAdminCreate = canCreate('leave_requests');

  const today = ymd(new Date());
  const [items, setItems] = useState<LeaveRequestAdmin[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['id']>('all');
  const [search, setSearch] = useState('');
  const [workingDays, setWorkingDays] = useState<string[]>([...DEFAULT_WORKING_DAYS]);
  const [balances, setBalances] = useState<OrgLeaveBalanceRow[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeAdmin[]>([]);

  const [rejectTarget, setRejectTarget] = useState<LeaveRequestAdmin | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [extendTarget, setExtendTarget] = useState<LeaveRequestAdmin | null>(null);
  const [extendToDate, setExtendToDate] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [employees, setEmployees] = useState<AdminUser[]>([]);
  const [createEmployeeId, setCreateEmployeeId] = useState('');
  const [createTypeId, setCreateTypeId] = useState('');
  const [createFrom, setCreateFrom] = useState(today);
  const [createTo, setCreateTo] = useState(today);
  const [createReason, setCreateReason] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [createBlocked, setCreateBlocked] = useState<Array<{ from_date: string; to_date: string }>>(
    [],
  );

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await listLeaveRequestsAdmin({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => void load(), 250);
      return () => clearTimeout(t);
    }, [load]),
  );

  useEffect(() => {
    void getLeaveWorkingDays()
      .then((res) =>
        setWorkingDays(res.working_days?.length ? res.working_days : [...DEFAULT_WORKING_DAYS]),
      )
      .catch(() => setWorkingDays([...DEFAULT_WORKING_DAYS]));
    void listOrgLeaveBalances()
      .then((res) => setBalances(res.items ?? []))
      .catch(() => setBalances([]));
    void listActiveLeaveTypes()
      .then(setLeaveTypes)
      .catch(() => setLeaveTypes([]));
  }, []);

  useEffect(() => {
    if (!showCreate) return;
    void listUsers(0, 100)
      .then((res) => setEmployees(res.items ?? []))
      .catch(() => setEmployees([]));
  }, [showCreate]);

  useEffect(() => {
    if (!createEmployeeId) {
      setCreateBlocked([]);
      return;
    }
    void listLeaveRequestsAdmin({ employee_id: createEmployeeId, page_size: 100 })
      .then((res) =>
        setCreateBlocked(
          res.items
            .filter((row) => row.status === 'pending' || row.status === 'approved')
            .map((row) => ({
              from_date: row.from_date || row.start_date || '',
              to_date: row.to_date || row.end_date || '',
            }))
            .filter((row) => row.from_date && row.to_date),
        ),
      )
      .catch(() => setCreateBlocked([]));
  }, [createEmployeeId]);

  const selectedEmployee = employees.find((e) => e.id === createEmployeeId);
  const selectedCreateType = leaveTypes.find((t) => t.id === createTypeId);
  const selectedCreateBalance = balances.find(
    (b) => b.employee_id === createEmployeeId && b.leave_type_id === createTypeId,
  );
  const createDays =
    createFrom && createTo
      ? computeWorkingDaysBetween(createFrom, createTo, workingDays)
      : 0;
  const createIsLimited = selectedCreateBalance
    ? selectedCreateBalance.annual_days != null
    : selectedCreateType?.allocation_mode !== 'unlimited';
  const createRemaining = selectedCreateBalance?.balance;
  const createBalanceExceeded =
    createRemaining != null && createIsLimited && createDays > createRemaining;

  async function onApprove(id: string) {
    setBusyId(id);
    try {
      await approveLeaveRequest(id);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setBusyId('');
    }
  }

  async function onRejectConfirm() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Reject', 'Enter a rejection reason.');
      return;
    }
    setBusyId(rejectTarget.id);
    try {
      await rejectLeaveRequest(rejectTarget.id, reason);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setBusyId('');
    }
  }

  function onCancelPress(item: LeaveRequestAdmin) {
    const from = item.from_date || item.start_date || '';
    const to = item.to_date || item.end_date || '';
    const preview = cancelLeaveBreakdown(from, to, today, workingDays);
    Alert.alert(
      'Cancel leave',
      `Cancel this approved leave?\n\nOriginal: ${preview.originalDays} day(s)\nUsed: ${preview.daysUsed} day(s)\nRefunded: ${preview.daysRefunded} day(s)`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel leave',
          style: 'destructive',
          onPress: () => void confirmCancel(item.id),
        },
      ],
    );
  }

  async function confirmCancel(id: string) {
    setBusyId(id);
    try {
      await cancelLeaveRequest(id);
      await load();
      void listOrgLeaveBalances()
        .then((res) => setBalances(res.items ?? []))
        .catch(() => undefined);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusyId('');
    }
  }

  function openExtend(item: LeaveRequestAdmin) {
    const to = item.to_date || item.end_date || today;
    setExtendTarget(item);
    setExtendToDate(addDaysYmd(to, 1));
  }

  async function onExtendConfirm() {
    if (!extendTarget) return;
    const currentTo = extendTarget.to_date || extendTarget.end_date || '';
    if (!extendToDate || extendToDate <= currentTo) {
      Alert.alert('Extend', 'Choose an end date after the current end date.');
      return;
    }
    setBusyId(extendTarget.id);
    try {
      await extendLeaveRequest(extendTarget.id, extendToDate);
      setExtendTarget(null);
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Extension failed');
    } finally {
      setBusyId('');
    }
  }

  function rangeOverlapsBlocked(
    from: string,
    to: string,
    ranges: Array<{ from_date: string; to_date: string }>,
  ) {
    const start = parseYmd(from);
    const end = parseYmd(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return true;
    const cursor = new Date(start);
    while (cursor <= end) {
      if (dateInLeaveRanges(ymd(cursor), ranges)) return true;
      cursor.setDate(cursor.getDate() + 1);
    }
    return false;
  }

  async function onCreateSubmit() {
    if (!createEmployeeId || !createTypeId || !createFrom || !createTo || !createReason.trim()) {
      Alert.alert('Apply', 'Please fill all required fields.');
      return;
    }
    if (createFrom < today) {
      Alert.alert('Apply', 'Past dates cannot be selected for leave.');
      return;
    }
    if (createDays <= 0) {
      Alert.alert('Apply', 'Select a range that includes at least one working day.');
      return;
    }
    if (!isWorkingDayIso(createFrom, workingDays) || !isWorkingDayIso(createTo, workingDays)) {
      Alert.alert('Apply', 'From and to dates must fall on working days.');
      return;
    }
    if (rangeOverlapsBlocked(createFrom, createTo, createBlocked)) {
      Alert.alert('Apply', 'Selected dates overlap an existing pending or approved request.');
      return;
    }
    const maxConsec = selectedCreateType?.max_consecutive_days ?? null;
    if (maxConsec != null && createDays > maxConsec) {
      Alert.alert('Apply', `This leave type allows at most ${maxConsec} consecutive working day(s).`);
      return;
    }
    if (createBalanceExceeded) {
      Alert.alert(
        'Apply',
        `Only ${createRemaining ?? 0} working day(s) remaining for this leave type.`,
      );
      return;
    }

    setCreateBusy(true);
    try {
      await createLeaveRequest({
        leave_type_id: createTypeId,
        from_date: createFrom,
        to_date: createTo,
        reason: createReason.trim(),
        employee_id: createEmployeeId,
      });
      setShowCreate(false);
      resetCreateForm();
      await load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setCreateBusy(false);
    }
  }

  function resetCreateForm() {
    setCreateEmployeeId('');
    setCreateTypeId('');
    setCreateFrom(today);
    setCreateTo(today);
    setCreateReason('');
    setEmployeeOpen(false);
    setTypeOpen(false);
  }

  const extendMinDate = useMemo(() => {
    if (!extendTarget) return parseYmd(today);
    const to = extendTarget.to_date || extendTarget.end_date || today;
    return parseYmd(addDaysYmd(to, 1));
  }, [extendTarget, today]);

  return (
    <RequireModuleAccess module="leave_requests" allowCreate>
      <SafeScreen>
        <ScreenHeader title="Leave requests" onBack={() => router.back()} />
        <View style={styles.body}>
          {loading && items.length === 0 ? <Text style={styles.meta}>Loading requests…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset }}
            ListHeaderComponent={
              <View style={styles.headerBlock}>
                <TextField
                  label="Search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Employee name"
                  autoCapitalize="words"
                />

                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {STATUS_FILTERS.map((opt) => {
                    const active = statusFilter === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setStatusFilter(opt.id)}>
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {canAdminCreate ? (
                  <OutlineButton
                    label="+ Apply for employee"
                    onPress={() => {
                      resetCreateForm();
                      setShowCreate(true);
                    }}
                  />
                ) : null}

                {loading && items.length > 0 ? (
                  <Text style={styles.meta}>Refreshing…</Text>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              !loading ? (
                <Text style={styles.empty}>
                  No leave requests match your filters. Try another status or search.
                </Text>
              ) : null
            }
            renderItem={({ item }) => {
              const from = item.from_date || item.start_date || '';
              const to = item.to_date || item.end_date || '';
              const busy = busyId === item.id;
              return (
                <View style={styles.row}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowTitleBlock}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.employee_name ?? 'Employee'}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {item.leave_type_name ?? 'Leave'} · {displayYmdRange(from, to)}
                      </Text>
                    </View>
                    <StatusPill
                      label={item.status}
                      tone={statusTone(item.status)}
                      style={styles.statusPill}
                    />
                  </View>
                  {item.reason ? (
                    <Text style={styles.reason} numberOfLines={2}>
                      {item.reason}
                    </Text>
                  ) : null}
                  {canDecide && item.status === 'pending' ? (
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.actionBtn, styles.actionApprove, busy && styles.actionDisabled]}
                        disabled={busy}
                        onPress={() => void onApprove(item.id)}>
                        <Text style={styles.actionApproveText}>
                          {busy ? '…' : 'Approve'}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.actionReject, busy && styles.actionDisabled]}
                        disabled={busy}
                        onPress={() => {
                          setRejectTarget(item);
                          setRejectReason('');
                        }}>
                        <Text style={styles.actionRejectText}>Reject</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {canDecide && item.status === 'approved' ? (
                    <View style={styles.actions}>
                      <Pressable
                        style={[styles.actionBtn, styles.actionNeutral, busy && styles.actionDisabled]}
                        disabled={busy}
                        onPress={() => openExtend(item)}>
                        <Text style={styles.actionNeutralText}>Extend</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.actionBtn, styles.actionReject, busy && styles.actionDisabled]}
                        disabled={busy}
                        onPress={() => onCancelPress(item)}>
                        <Text style={styles.actionRejectText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
        </View>

        <Modal visible={Boolean(rejectTarget)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Reject leave request</Text>
              <Text style={styles.meta}>
                {rejectTarget?.employee_name ?? 'Employee'} ·{' '}
                {rejectTarget?.leave_type_name ?? 'Leave'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Rejection reason *"
                placeholderTextColor={Colors.muted}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
              <PrimaryButton
                label="Confirm reject"
                onPress={() => void onRejectConfirm()}
                loading={busyId === rejectTarget?.id}
              />
              <Pressable
                onPress={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(extendTarget)} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Extend approved leave</Text>
              <Text style={styles.meta}>
                {extendTarget?.employee_name ?? 'Employee'} ·{' '}
                {extendTarget?.leave_type_name ?? 'Leave'}
              </Text>
              <Text style={styles.meta}>
                Current end:{' '}
                {extendTarget
                  ? displayYmdRange(
                      extendTarget.to_date || extendTarget.end_date || '',
                      extendTarget.to_date || extendTarget.end_date || '',
                    )
                  : '—'}
              </Text>
              <DateField
                label="New to date"
                value={extendToDate}
                onChange={setExtendToDate}
                minimumDate={extendMinDate}
              />
              <PrimaryButton
                label="Confirm extend"
                onPress={() => void onExtendConfirm()}
                loading={busyId === extendTarget?.id}
              />
              <Pressable onPress={() => setExtendTarget(null)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={showCreate} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Apply for employee</Text>

                <Text style={styles.fieldLabel}>Employee *</Text>
                <Pressable style={styles.select} onPress={() => setEmployeeOpen((v) => !v)}>
                  <Text style={styles.selectText}>
                    {selectedEmployee?.name || 'Select employee'}
                  </Text>
                </Pressable>
                {employeeOpen
                  ? employees.map((emp) => (
                      <Pressable
                        key={emp.id}
                        style={styles.option}
                        onPress={() => {
                          setCreateEmployeeId(emp.id);
                          setEmployeeOpen(false);
                        }}>
                        <Text style={styles.optionText}>{emp.name}</Text>
                      </Pressable>
                    ))
                  : null}

                <Text style={styles.fieldLabel}>Leave type *</Text>
                <Pressable style={styles.select} onPress={() => setTypeOpen((v) => !v)}>
                  <Text style={styles.selectText}>
                    {selectedCreateType?.name || 'Select leave type'}
                  </Text>
                </Pressable>
                {typeOpen
                  ? leaveTypes.map((lt) => (
                      <Pressable
                        key={lt.id}
                        style={styles.option}
                        onPress={() => {
                          setCreateTypeId(lt.id);
                          setTypeOpen(false);
                        }}>
                        <Text style={styles.optionText}>{lt.name}</Text>
                      </Pressable>
                    ))
                  : null}

                {selectedCreateBalance ? (
                  <Text style={styles.meta}>
                    Remaining balance: {selectedCreateBalance.balance} day(s)
                  </Text>
                ) : null}

                <DateField
                  label="From date"
                  value={createFrom}
                  onChange={(v) => {
                    setCreateFrom(v);
                    if (parseYmd(v) > parseYmd(createTo)) setCreateTo(v);
                  }}
                  minimumDate={parseYmd(today)}
                />
                <DateField
                  label="To date"
                  value={createTo}
                  onChange={setCreateTo}
                  minimumDate={parseYmd(createFrom)}
                />
                <Text style={styles.meta}>
                  Selected: {createDays} working day{createDays === 1 ? '' : 's'}
                </Text>

                <Text style={styles.fieldLabel}>Reason *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Reason"
                  placeholderTextColor={Colors.muted}
                  value={createReason}
                  onChangeText={setCreateReason}
                  multiline
                />

                <PrimaryButton
                  label="Submit request"
                  onPress={() => void onCreateSubmit()}
                  loading={createBusy}
                />
                <Pressable
                  onPress={() => {
                    setShowCreate(false);
                    resetCreateForm();
                  }}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </SafeScreen>
    </RequireModuleAccess>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  headerBlock: { gap: Spacing.sm, marginBottom: Spacing.sm },
  meta: { color: Colors.muted, fontSize: 13 },
  empty: { color: Colors.muted, fontSize: 13, lineHeight: 20, paddingVertical: Spacing.md },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  filterLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.brand,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
  chipTextActive: {
    color: Colors.brand,
    fontWeight: '700',
  },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitleBlock: { flex: 1, gap: 2, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.heading },
  sub: { color: Colors.muted, fontSize: 12, lineHeight: 16 },
  reason: { color: Colors.text, fontSize: 12, lineHeight: 16 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionDisabled: { opacity: 0.55 },
  actionApprove: {
    backgroundColor: Colors.brand,
  },
  actionApproveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionReject: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  actionRejectText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  actionNeutral: {
    backgroundColor: Colors.brandSoft,
    borderWidth: 1,
    borderColor: Colors.brand,
  },
  actionNeutralText: {
    color: Colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.md },
  modalCard: {
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.heading },
  select: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  selectText: { fontWeight: '600', color: Colors.heading },
  option: { paddingVertical: 10, paddingHorizontal: 8 },
  optionText: { fontWeight: '600', color: Colors.heading },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 12,
    textAlignVertical: 'top',
    color: Colors.heading,
  },
  cancel: { textAlign: 'center', color: Colors.muted, fontWeight: '700', paddingVertical: 8 },
});
