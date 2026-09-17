import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import RequireModuleAccess from '@/components/RequireModuleAccess';
import { OutlineButton } from '@/components/ui/OutlineButton';
import { KeyboardSafeScrollView } from '@/components/ui/KeyboardSafeScrollView';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SafeScreen, useContentBottomInset } from '@/components/ui/SafeScreen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StatusPill } from '@/components/ui/StatusPill';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePermissions } from '@/hooks/usePermissions';
import { getFieldOperationsSettings } from '@/lib/api/org';
import {
  assignVisitsBatch,
  deleteVisitAssignment,
  getAssignedVisits,
  getVisitAssignOptions,
  getVisitHistory,
  updateVisitAssignment,
  type FieldVisit,
  type VisitAssignEmployeeOption,
  type VisitAssignOption,
} from '@/lib/api/visits';
import { formatDate } from '@/lib/format';
import { ymd } from '@/lib/leaveUi';

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function workingDatesInRange(startIso: string, endIso: string, workingDays: string[]) {
  const allowed = new Set(workingDays.map((d) => d.toLowerCase()));
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const dates: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    if (allowed.has(WEEKDAY_KEYS[cur.getDay()])) dates.push(ymd(cur));
  }
  return dates;
}

function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function VisitAssignScreen() {
  return (
    <RequireModuleAccess module="visit_assign" allowCreate>
      <VisitAssignContent />
    </RequireModuleAccess>
  );
}

function VisitAssignContent() {
  const bottomInset = useContentBottomInset();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const canCreateAssignment = canCreate('visit_assign');
  const canEditAssignment = canEdit('visit_assign');
  const canDeleteAssignment = canDelete('visit_assign');
  const [items, setItems] = useState<FieldVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FieldVisit | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      try {
        const res = await getAssignedVisits();
        setItems(res.items);
      } catch {
        const res = await getVisitHistory({ status: 'assigned', limit: 100 });
        setItems(res.items);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending visits');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmDelete(item: FieldVisit) {
    if (!canDeleteAssignment) return;
    Alert.alert(
      'Delete visit',
      `Delete the visit assigned to ${item.employee_name ?? 'this employee'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteVisitAssignment(item.id);
                await load();
              } catch (err) {
                Alert.alert(
                  'Error',
                  err instanceof Error ? err.message : 'Failed to delete visit',
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeScreen>
      <ScreenHeader title="Visit assign" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.sub}>
          Pending assigned visits
          {canCreateAssignment ? '. Tap Add visit to schedule one.' : '.'}
        </Text>
        {canCreateAssignment ? (
          <OutlineButton label="+ Add visit" onPress={() => setModalOpen(true)} />
        ) : null}
        {loading ? <Text style={styles.meta}>Loading…</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: Spacing.sm, paddingBottom: bottomInset }}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No pending visits</Text>
                <Text style={styles.emptyCopy}>
                  Assigned visits waiting to be completed will show up here.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.name}>{item.employee_name ?? 'Employee'}</Text>
                <Text style={styles.addr}>{item.dealer_name ?? 'Dealer'}</Text>
                <Text style={styles.addr}>{formatDate(item.scheduled_at)}</Text>
                {canEditAssignment || canDeleteAssignment ? (
                  <View style={styles.actionRow}>
                    {canEditAssignment ? (
                      <Pressable onPress={() => setEditing(item)}>
                        <Text style={styles.editAction}>Edit</Text>
                      </Pressable>
                    ) : null}
                    {canDeleteAssignment ? (
                      <Pressable onPress={() => confirmDelete(item)}>
                        <Text style={styles.deleteAction}>Delete</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <StatusPill label="Pending" tone="pending" />
            </View>
          )}
        />
      </View>

      <AssignVisitModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAssigned={async () => {
          setModalOpen(false);
          await load();
        }}
      />
      {editing ? (
        <EditVisitModal
          visit={editing}
          visible
          onClose={() => setEditing(null)}
          onUpdated={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}
    </SafeScreen>
  );
}

function AssignVisitModal({
  visible,
  onClose,
  onAssigned,
}: {
  visible: boolean;
  onClose: () => void;
  onAssigned: () => Promise<void>;
}) {
  const [employees, setEmployees] = useState<VisitAssignEmployeeOption[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
  ]);
  const [employeeId, setEmployeeId] = useState('');
  const [span, setSpan] = useState<'single' | 'range'>('single');
  const [startDate, setStartDate] = useState(() => ymd(new Date()));
  const [endDate, setEndDate] = useState(() => ymd(new Date()));
  const [picking, setPicking] = useState<'start' | 'end' | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [dayDealers, setDayDealers] = useState<Record<string, string[]>>({});
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEmployeeId('');
    setSpan('single');
    const today = ymd(new Date());
    setStartDate(today);
    setEndDate(today);
    setDates([]);
    setDayDealers({});
    setError('');
    void Promise.all([
      getVisitAssignOptions(),
      getFieldOperationsSettings().catch(() => null),
    ])
      .then(([options, settings]) => {
        setEmployees(options.employees ?? []);
        if (settings?.working_days?.length) setWorkingDays(settings.working_days);
      })
      .catch(() => {
        setEmployees([]);
      });
  }, [visible]);

  function generate() {
    const end = span === 'single' ? startDate : endDate;
    if (span === 'range' && end < startDate) {
      setError('End date must be after start date.');
      return;
    }
    const next = workingDatesInRange(startDate, end, workingDays);
    if (next.length === 0) {
      setError('No working days in this range. Check Field ops working-day toggles.');
      setDates([]);
      return;
    }
    setError('');
    setDayDealers((prev) => {
      const mapped: Record<string, string[]> = {};
      for (const date of next) mapped[date] = prev[date] ?? [];
      return mapped;
    });
    setDates(next);
  }

  function toggleDealer(date: string, dealerId: string) {
    setDayDealers((prev) => {
      const current = new Set(prev[date] ?? []);
      if (current.has(dealerId)) current.delete(dealerId);
      else current.add(dealerId);
      return { ...prev, [date]: Array.from(current) };
    });
  }

  async function submit() {
    if (!employeeId) {
      setError('Choose an employee.');
      return;
    }
    if (dates.length === 0) {
      setError('Generate dates first.');
      return;
    }
    const days = dates.map((date) => ({ date, dealer_ids: dayDealers[date] ?? [] }));
    if (days.some((d) => d.dealer_ids.length === 0)) {
      setError('Select at least one dealer for every date.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await assignVisitsBatch({ employee_id: employeeId, days });
      await onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
    } finally {
      setLoading(false);
    }
  }
  const insets = useSafeAreaInsets();

  const employee = employees.find((e) => e.id === employeeId);
  const dealers: VisitAssignOption[] = employee?.dealers ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add visit</Text>
          <Text style={styles.sub}>Pick a range, then set dealers for each working day.</Text>
          <KeyboardSafeScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 24 }} keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Employee *</Text>
            <Pressable style={styles.select} onPress={() => setShowEmployeePicker(true)}>
              <Text style={styles.selectText}>{employee?.name ?? 'Select employee'}</Text>
            </Pressable>

            <Text style={styles.label}>Visit span</Text>
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggle, span === 'single' && styles.toggleActive]}
                onPress={() => setSpan('single')}>
                <Text style={[styles.toggleText, span === 'single' && styles.toggleTextActive]}>Single day</Text>
              </Pressable>
              <Pressable
                style={[styles.toggle, span === 'range' && styles.toggleActive]}
                onPress={() => setSpan('range')}>
                <Text style={[styles.toggleText, span === 'range' && styles.toggleTextActive]}>Date range</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>{span === 'range' ? 'Start date' : 'Date'} *</Text>
            <Pressable style={styles.select} onPress={() => setPicking('start')}>
              <Text style={styles.selectText}>{startDate}</Text>
            </Pressable>
            {span === 'range' ? (
              <>
                <Text style={styles.label}>End date *</Text>
                <Pressable style={styles.select} onPress={() => setPicking('end')}>
                  <Text style={styles.selectText}>{endDate}</Text>
                </Pressable>
              </>
            ) : null}
            {picking ? (
              <DateTimePicker
                value={new Date(`${(picking === 'start' ? startDate : endDate)}T00:00:00`)}
                mode="date"
                onChange={(_, date) => {
                  setPicking(Platform.OS === 'ios' ? picking : null);
                  if (date) {
                    const next = ymd(date);
                    if (picking === 'start') setStartDate(next);
                    else setEndDate(next);
                  }
                }}
              />
            ) : null}

            <OutlineButton label="Generate dates" onPress={generate} />
            <Text style={styles.meta}>Only Field ops working days are included.</Text>

            {dates.map((date) => (
              <View key={date} style={styles.dayCard}>
                <Text style={styles.name}>{dayLabel(date)}</Text>
                <Text style={styles.label}>Dealers</Text>
                {dealers.length === 0 ? (
                  <Text style={styles.meta}>
                    {employeeId
                      ? 'No dealers assigned to this employee.'
                      : 'Select an employee to see assigned dealers.'}
                  </Text>
                ) : (
                  dealers.map((dealer) => {
                    const checked = (dayDealers[date] ?? []).includes(dealer.id);
                    return (
                      <Pressable
                        key={dealer.id}
                        style={styles.checkRow}
                        onPress={() => toggleDealer(date, dealer.id)}>
                        <View style={[styles.box, checked && styles.boxOn]} />
                        <Text style={styles.checkLabel}>{dealer.name}</Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton label="Assign visit" loading={loading} onPress={() => void submit()} />
            <OutlineButton label="Cancel" onPress={onClose} />
          </KeyboardSafeScrollView>
        </View>
      </View>

      <PickerModal
        visible={showEmployeePicker}
        title="Choose employee"
        options={employees.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setShowEmployeePicker(false)}
        onSelect={(id) => {
          setEmployeeId(id);
          setDayDealers({});
          setShowEmployeePicker(false);
        }}
      />
    </Modal>
  );
}

function EditVisitModal({
  visit,
  visible,
  onClose,
  onUpdated,
}: {
  visit: FieldVisit;
  visible: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [employees, setEmployees] = useState<VisitAssignEmployeeOption[]>([]);
  const [employeeId, setEmployeeId] = useState(visit.employee_id);
  const [dealerId, setDealerId] = useState(visit.dealer_id);
  const [scheduledDate, setScheduledDate] = useState(() =>
    ymd(new Date(visit.scheduled_at)),
  );
  const [pickingDate, setPickingDate] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showDealerPicker, setShowDealerPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEmployeeId(visit.employee_id);
    setDealerId(visit.dealer_id);
    setScheduledDate(ymd(new Date(visit.scheduled_at)));
    setError('');
    void getVisitAssignOptions()
      .then((options) => setEmployees(options.employees ?? []))
      .catch(() => {
        setEmployees([]);
        setError('Failed to load assignment options.');
      });
  }, [visible, visit]);

  const employee = employees.find((e) => e.id === employeeId);
  const dealers: VisitAssignOption[] = employee?.dealers ?? [];
  const dealer = dealers.find((d) => d.id === dealerId);

  async function submit() {
    if (!employeeId || !dealerId || !scheduledDate) {
      setError('Employee, dealer, and date are required.');
      return;
    }
    const existingTime = visit.scheduled_at.includes('T')
      ? visit.scheduled_at.split('T')[1]?.slice(0, 8)
      : null;
    const timePart = existingTime && existingTime.length >= 5 ? existingTime : '09:00:00';
    setLoading(true);
    setError('');
    try {
      await updateVisitAssignment(visit.id, {
        employee_id: employeeId,
        dealer_id: dealerId,
        scheduled_at: `${scheduledDate}T${timePart}`,
      });
      await onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update visit.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit visit</Text>
          <KeyboardSafeScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Employee *</Text>
            <Pressable style={styles.select} onPress={() => setShowEmployeePicker(true)}>
              <Text style={styles.selectText}>
                {employee?.name ?? visit.employee_name ?? 'Select employee'}
              </Text>
            </Pressable>

            <Text style={styles.label}>Dealer *</Text>
            <Pressable
              style={styles.select}
              onPress={() => {
                if (!employeeId) {
                  setError('Choose an employee first.');
                  return;
                }
                setShowDealerPicker(true);
              }}>
              <Text style={styles.selectText}>
                {dealer?.name ?? visit.dealer_name ?? 'Select dealer'}
              </Text>
            </Pressable>

            <Text style={styles.label}>Scheduled date *</Text>
            <Pressable style={styles.select} onPress={() => setPickingDate(true)}>
              <Text style={styles.selectText}>{scheduledDate}</Text>
            </Pressable>
            {pickingDate ? (
              <DateTimePicker
                value={new Date(`${scheduledDate}T00:00:00`)}
                mode="date"
                onChange={(_, date) => {
                  setPickingDate(Platform.OS === 'ios');
                  if (date) setScheduledDate(ymd(date));
                }}
              />
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <PrimaryButton label="Save changes" loading={loading} onPress={() => void submit()} />
            <OutlineButton label="Cancel" onPress={onClose} />
          </KeyboardSafeScrollView>
        </View>
      </View>

      <PickerModal
        visible={showEmployeePicker}
        title="Choose employee"
        options={employees.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setShowEmployeePicker(false)}
        onSelect={(id) => {
          setEmployeeId(id);
          setDealerId('');
          setShowEmployeePicker(false);
        }}
      />
      <PickerModal
        visible={showDealerPicker}
        title="Choose dealer"
        options={dealers.map((d) => ({ id: d.id, name: d.name }))}
        onClose={() => setShowDealerPicker(false)}
        onSelect={(id) => {
          setDealerId(id);
          setShowDealerPicker(false);
        }}
      />
    </Modal>
  );
}

function PickerModal({
  visible,
  title,
  options,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: { id: string; name: string }[];
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <View style={styles.pickerCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <Pressable style={styles.pickerRow} onPress={() => onSelect(item.id)}>
                <Text style={styles.name}>{item.name}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No options</Text>
                <Text style={styles.emptyCopy}>Nothing available to choose from right now.</Text>
              </View>
            }
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: Spacing.md, gap: Spacing.sm },
  sub: { color: Colors.muted, lineHeight: 20 },
  meta: { color: Colors.muted, fontSize: 12 },
  error: { color: Colors.danger },
  emptyWrap: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 6 },
  emptyTitle: { color: Colors.heading, fontWeight: '700', fontSize: 15, textAlign: 'center' },
  emptyCopy: { color: Colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  row: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: { fontWeight: '700', color: Colors.heading, fontSize: 15 },
  addr: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  editAction: { color: Colors.brand, fontWeight: '700', fontSize: 12 },
  deleteAction: { color: Colors.danger, fontWeight: '700', fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 20,
  },

  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '92%',
    maxHeight: '92%',
    flex: 1,
    overflow: 'hidden',
    padding: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.heading, marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.heading,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  select: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.background,
  },
  selectText: { fontWeight: '700', color: Colors.heading },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  toggleActive: { backgroundColor: Colors.brandSoft, borderColor: Colors.brandSoft },
  toggleText: { fontWeight: '700', color: Colors.heading, fontSize: 13 },
  toggleTextActive: { color: Colors.brandDark },
  dayCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    gap: 6,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  boxOn: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  checkLabel: { color: Colors.heading, fontWeight: '600', flex: 1 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  pickerRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
});
